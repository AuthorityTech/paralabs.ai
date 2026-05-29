#!/usr/bin/env node
/**
 * validate-live-schema.mjs — Live URL schema validator for all AT sites.
 *
 * Fetches rendered pages, extracts JSON-LD, validates against:
 *   1. Schema.org vocabulary (spec-derived from schemaorg-current-https.jsonld)
 *      — type recognition, property domain/range constraints
 *   2. Google Rich Results eligibility rules (FAQ, Article, BreadcrumbList, etc.)
 *   3. Ontology integrity (entity IDs, cross-references, forbidden fields)
 *
 * The schema.org validation layer loads a cached vocabulary derived from the
 * official machine-readable spec. Run --refresh-vocab to re-download.
 *
 * Usage:
 *   node scripts/validate-live-schema.mjs                          # all sites, sample pages
 *   node scripts/validate-live-schema.mjs --url https://example.com/page
 *   node scripts/validate-live-schema.mjs --site machinerelations.ai
 *   node scripts/validate-live-schema.mjs --all                    # every known page
 *   node scripts/validate-live-schema.mjs --json                   # JSON output
 *   node scripts/validate-live-schema.mjs --refresh-vocab           # rebuild vocabulary cache
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOCAB_CACHE_PATH = join(__dirname, "schema-vocab-cache.json");

// ─── Early CLI check for --refresh-vocab ────────────────────────────────────

const cliArgs = process.argv.slice(2);

if (cliArgs.includes("--refresh-vocab")) {
  console.error("Downloading schema.org vocabulary...");
  const res = await fetch(
    "https://schema.org/version/latest/schemaorg-current-https.jsonld",
  );
  if (!res.ok) {
    console.error(`Failed to download: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const vocab = await res.json();
  const graph = vocab["@graph"];

  const strip = (id) => id?.replace("schema:", "") || null;
  const stripArr = (arr) =>
    (Array.isArray(arr) ? arr : arr ? [arr] : [])
      .map((e) => strip(e["@id"]))
      .filter(Boolean);

  // Build type set + parent map
  const types = new Set();
  const parentMap = {};
  for (const e of graph) {
    if (e["@id"]?.startsWith("schema:")) {
      const typeArr = Array.isArray(e["@type"]) ? e["@type"] : [e["@type"]];
      if (typeArr.includes("rdfs:Class")) {
        const name = strip(e["@id"]);
        types.add(name);
        const parents = stripArr(e["rdfs:subClassOf"]);
        if (parents.length) parentMap[name] = parents;
      }
    }
  }

  // DataTypes: entries with @type including schema:DataType + their subclasses
  const dataTypeSet = new Set();
  for (const e of graph) {
    if (!e["@id"]?.startsWith("schema:")) continue;
    const typeArr = Array.isArray(e["@type"]) ? e["@type"] : [e["@type"]];
    if (typeArr.includes("schema:DataType")) dataTypeSet.add(strip(e["@id"]));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [type, parents] of Object.entries(parentMap)) {
      if (!dataTypeSet.has(type) && parents.some((p) => dataTypeSet.has(p))) {
        dataTypeSet.add(type);
        changed = true;
      }
    }
  }

  // Resolve full ancestor chains (BFS)
  function getAncestors(type) {
    const ancestors = [];
    const visited = new Set();
    const queue = [...(parentMap[type] || [])];
    while (queue.length) {
      const parent = queue.shift();
      if (visited.has(parent)) continue;
      visited.add(parent);
      ancestors.push(parent);
      if (parentMap[parent]) queue.push(...parentMap[parent]);
    }
    return ancestors;
  }

  const hierarchy = {};
  for (const t of types) {
    const anc = getAncestors(t);
    if (anc.length) hierarchy[t] = anc;
  }

  // Property domain/range maps
  const domains = {};
  const ranges = {};
  for (const e of graph) {
    if (e["@type"] === "rdf:Property" && e["@id"]?.startsWith("schema:")) {
      const name = strip(e["@id"]);
      const d = stripArr(e["schema:domainIncludes"]);
      const r = stripArr(e["schema:rangeIncludes"]);
      if (d.length) domains[name] = d;
      if (r.length) ranges[name] = r;
    }
  }

  const cache = {
    meta: {
      version: "latest",
      builtAt: new Date().toISOString(),
      stats: {
        types: types.size,
        properties: Object.keys(domains).length,
        dataTypes: dataTypeSet.size,
      },
    },
    types: [...types].sort(),
    hierarchy,
    domains,
    ranges,
    dataTypes: [...dataTypeSet].sort(),
  };

  writeFileSync(VOCAB_CACHE_PATH, JSON.stringify(cache));
  console.error(
    `Vocabulary cache built: ${types.size} types, ${Object.keys(domains).length} properties, ${dataTypeSet.size} data types`,
  );
  console.error(`Saved to: ${VOCAB_CACHE_PATH}`);
  process.exit(0);
}

// ─── Load Schema.org Vocabulary Cache ───────────────────────────────────────

let vocabTypes, vocabHierarchy, vocabDomains, vocabRanges, vocabDataTypes;
try {
  const cache = JSON.parse(readFileSync(VOCAB_CACHE_PATH, "utf8"));
  vocabTypes = new Set(cache.types);
  vocabHierarchy = cache.hierarchy;
  vocabDomains = cache.domains;
  vocabRanges = cache.ranges;
  vocabDataTypes = new Set(cache.dataTypes);
} catch {
  console.error(
    "Schema.org vocabulary cache not found. Run with --refresh-vocab to build it.",
  );
  process.exit(1);
}

/**
 * Get the full ancestor chain for a type (including the type itself).
 * Returns [type, parent, grandparent, ..., Thing].
 */
function getTypeChain(type) {
  return [type, ...(vocabHierarchy[type] || [])];
}

/**
 * Check if a property is valid on a given node type (domain check).
 * Returns true if the property's domainIncludes matches any ancestor of the node type.
 */
function isPropertyInDomain(prop, nodeTypes) {
  const propDomains = vocabDomains[prop];
  if (!propDomains) return true; // Property not in vocab — can't validate domain
  return nodeTypes.some((t) => {
    const chain = getTypeChain(t);
    return chain.some((ancestor) => propDomains.includes(ancestor));
  });
}

/**
 * Check if a value type is valid for a property (range check).
 * Returns true if the value's @type matches any type in the property's rangeIncludes.
 */
function isValueInRange(prop, valueTypes) {
  const propRanges = vocabRanges[prop];
  if (!propRanges) return true; // Property not in vocab — can't validate range
  return valueTypes.some((vt) => {
    const chain = getTypeChain(vt);
    return chain.some((ancestor) => propRanges.includes(ancestor));
  });
}

// ─── Configuration ──────────────────────────────────────────────────────────

const SITES = {
  "machinerelations.ai": {
    base: "https://machinerelations.ai",
    pages: [
      "/",
      "/glossary",
      "/glossary/machine-relations",
      "/glossary/generative-engine-optimization",
      "/stack",
      "/research",
      "/research/ai-citation-frequency-benchmark",
      "/evidence",
      "/press",
    ],
    entity: "MR",
  },
  "authoritytech.io": {
    base: "https://authoritytech.io",
    pages: [
      "/",
      "/blog",
      "/blog/machine-relations-explained",
    ],
    entity: "AT",
  },
  "jaxonparrott.com": {
    base: "https://jaxonparrott.com",
    pages: ["/", "/blog"],
    entity: "JP",
  },
  "christianlehman.com": {
    base: "https://christianlehman.com",
    pages: ["/", "/blog"],
    entity: "CL",
  },
  "paralax.ai": {
    base: "https://paralax.ai",
    pages: ["/"],
    entity: "PX",
  },
  "paralabs.ai": {
    base: "https://paralabs.ai",
    pages: ["/"],
    entity: "PL",
  },
};

// Canonical entity IDs from @editorialkit/schema
const CANONICAL_IDS = {
  MR_TERM: "https://machinerelations.ai/#term",
  MR_TERM_SET: "https://machinerelations.ai/glossary#definedtermset",
  MR_WEBSITE: "https://machinerelations.ai/#website",
  MR_HOMEPAGE: "https://machinerelations.ai/#webpage",
  MR_COINING: "https://machinerelations.ai/#coining",
  MR_FAQ: "https://machinerelations.ai/#faq",
  MR_HERO_DIAGRAM: "https://machinerelations.ai/#hero-diagram",
  JAXON_PERSON: "https://jaxonparrott.com/#person",
  CHRISTIAN_PERSON: "https://christianlehman.com/#person",
  AUTHORITYTECH_ORG: "https://authoritytech.io/#organization",
};

const LEGACY_IDS = new Set([
  "https://machinerelations.ai/#termset",
  "https://machinerelations.ai/glossary#set",
]);

// Types Google recognizes for rich results
const GOOGLE_RICH_RESULT_TYPES = new Set([
  "Article", "NewsArticle", "BlogPosting", "TechArticle",
  "FAQPage", "HowTo", "BreadcrumbList", "WebSite",
  "Organization", "Person", "LocalBusiness",
  "Product", "Review", "AggregateRating",
  "Event", "Recipe", "VideoObject",
  "ItemList", "Course", "Dataset",
  "SoftwareApplication", "Book",
]);

// Satellite sites must not reference AT entities
const SATELLITE_DOMAINS = new Set(["paralax.ai", "paralabs.ai"]);

// ─── Spec-Derived Validation (schema.org vocabulary) ────────────────────────

function validateSpecCompliance(node, url, path, issues, allNodes) {
  const nodeType = node["@type"];
  if (!nodeType) return;

  const nodeTypes = Array.isArray(nodeType) ? nodeType : [nodeType];

  // 1. Flag unrecognized @type values
  for (const t of nodeTypes) {
    if (!vocabTypes.has(t)) {
      issues.push({
        severity: "error",
        url,
        path: `${path}.@type`,
        message: `"${t}" is not a recognized schema.org type`,
      });
    }
  }

  // 2. Validate each property on this node
  for (const [prop, value] of Object.entries(node)) {
    // Skip JSON-LD keywords
    if (prop.startsWith("@")) continue;

    // 2a. Is this a known schema.org property?
    const inDomains = prop in vocabDomains;
    const inRanges = prop in vocabRanges;
    if (!inDomains && !inRanges) {
      // Not a recognized schema.org property — could be a valid extension
      // but validator.schema.org would flag it
      issues.push({
        severity: "warning",
        url,
        path: `${path}.${prop}`,
        message: `"${prop}" is not a recognized schema.org property`,
      });
      continue;
    }

    // 2b. Domain check: is this property valid for this node's type?
    if (inDomains && !isPropertyInDomain(prop, nodeTypes)) {
      issues.push({
        severity: "warning",
        url,
        path: `${path}.${prop}`,
        message: `"${prop}" is not recognized on type "${nodeTypes.join(", ")}"`,
      });
    }

    // 2c. Range check: do object values have valid @types?
    const propRanges = vocabRanges[prop];
    if (!propRanges) continue;

    // Only range-check when ALL ranges are non-DataType schema.org types.
    // If any range is a DataType (Text, URL, Number, etc.), string/number
    // values are valid and we can't distinguish them from incorrect types.
    const hasObjectRange = propRanges.some((r) => !vocabDataTypes.has(r));
    if (!hasObjectRange) continue;

    const values = Array.isArray(value) ? value : [value];
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null || typeof v !== "object") continue;

      // Resolve @id references to find actual type
      let valueType = v["@type"];
      if (!valueType && v["@id"]) {
        const resolved = allNodes.find((n) => n["@id"] === v["@id"]);
        if (resolved) valueType = resolved["@type"];
      }

      // Skip bare @id references we can't resolve
      if (!valueType) continue;

      const valueTypes = Array.isArray(valueType) ? valueType : [valueType];

      if (!isValueInRange(prop, valueTypes)) {
        const suffix = Array.isArray(value) ? `[${i}]` : "";
        issues.push({
          severity: "error",
          url,
          path: `${path}.${prop}${suffix}`,
          message: `Expected ${propRanges.filter((r) => !vocabDataTypes.has(r)).join(" or ")} for "${prop}", got "${valueTypes.join(", ")}"`,
        });
      }

      // Also flag unrecognized types on nested objects
      for (const vt of valueTypes) {
        if (!vocabTypes.has(vt)) {
          const suffix = Array.isArray(value) ? `[${i}]` : "";
          issues.push({
            severity: "error",
            url,
            path: `${path}.${prop}${suffix}.@type`,
            message: `"${vt}" is not a recognized schema.org type`,
          });
        }
      }
    }
  }
}

// ─── Validation Rules ───────────────────────────────────────────────────────

function validateNode(node, url, path, issues) {
  const type = node["@type"];
  const id = node["@id"];

  // Legacy ID check
  if (typeof id === "string" && LEGACY_IDS.has(id)) {
    issues.push({ severity: "error", url, path, message: `Legacy @id detected: ${id}` });
  }

  // Google Rich Results: FAQPage
  if (type === "FAQPage") {
    const entities = node.mainEntity;
    if (!Array.isArray(entities) || entities.length === 0) {
      issues.push({ severity: "error", url, path, message: "FAQPage requires mainEntity array with Question items (Google Rich Results)" });
    } else {
      for (let i = 0; i < entities.length; i++) {
        const q = entities[i];
        if (q["@type"] !== "Question") {
          issues.push({ severity: "error", url, path: `${path}.mainEntity[${i}]`, message: `FAQPage entity must be @type Question, got: ${q["@type"]}` });
        }
        if (!q.name || typeof q.name !== "string") {
          issues.push({ severity: "error", url, path: `${path}.mainEntity[${i}]`, message: "Question requires 'name' (the question text)" });
        }
        const answer = q.acceptedAnswer;
        if (!answer || answer["@type"] !== "Answer" || !answer.text) {
          issues.push({ severity: "error", url, path: `${path}.mainEntity[${i}].acceptedAnswer`, message: "Question requires acceptedAnswer with @type Answer and text" });
        }
      }
    }
  }

  // Google Rich Results: Article
  if (["Article", "NewsArticle", "BlogPosting", "TechArticle"].includes(type)) {
    if (!node.headline && !node.name) {
      issues.push({ severity: "warning", url, path, message: "Article should have headline or name (Google recommended)" });
    }
    if (!node.author) {
      issues.push({ severity: "warning", url, path, message: "Article should have author (Google recommended)" });
    }
    if (!node.datePublished) {
      issues.push({ severity: "warning", url, path, message: "Article should have datePublished (Google recommended)" });
    }
    if (!node.image && !node.thumbnailUrl) {
      issues.push({ severity: "warning", url, path, message: "Article should have image (Google recommended for rich results)" });
    }
  }

  // Google Rich Results: BreadcrumbList
  if (type === "BreadcrumbList") {
    if (!Array.isArray(node.itemListElement) || node.itemListElement.length === 0) {
      issues.push({ severity: "error", url, path, message: "BreadcrumbList requires itemListElement array" });
    } else {
      for (let i = 0; i < node.itemListElement.length; i++) {
        const li = node.itemListElement[i];
        if (li["@type"] !== "ListItem") {
          issues.push({ severity: "error", url, path: `${path}.itemListElement[${i}]`, message: `BreadcrumbList item must be ListItem, got: ${li["@type"]}` });
        }
        if (typeof li.position !== "number") {
          issues.push({ severity: "error", url, path: `${path}.itemListElement[${i}]`, message: "ListItem requires numeric position" });
        }
        if (!li.name && !li.item?.name) {
          issues.push({ severity: "warning", url, path: `${path}.itemListElement[${i}]`, message: "ListItem should have name" });
        }
      }
    }
  }

  // Google Rich Results: HowTo
  if (type === "HowTo") {
    if (!node.name) {
      issues.push({ severity: "error", url, path, message: "HowTo requires name" });
    }
    if (!Array.isArray(node.step) || node.step.length === 0) {
      issues.push({ severity: "error", url, path, message: "HowTo requires step array" });
    }
  }

  // Google Rich Results: Dataset
  if (type === "Dataset") {
    if (!node.name) {
      issues.push({ severity: "error", url, path, message: "Dataset requires name (Google)" });
    }
    if (!node.description) {
      issues.push({ severity: "error", url, path, message: "Dataset requires description (Google)" });
    }
  }

  // Google Rich Results: WebSite with SearchAction
  if (type === "WebSite") {
    if (!node.name) {
      issues.push({ severity: "warning", url, path, message: "WebSite should have name" });
    }
    if (!node.url) {
      issues.push({ severity: "warning", url, path, message: "WebSite should have url" });
    }
  }

  // Person sameAs validation
  if (type === "Person" && Array.isArray(node.sameAs)) {
    const seen = new Set();
    for (const u of node.sameAs) {
      if (typeof u !== "string") {
        issues.push({ severity: "error", url, path, message: "Person.sameAs entries must be strings" });
      } else if (seen.has(u)) {
        issues.push({ severity: "error", url, path, message: `Duplicate sameAs: ${u}` });
      } else {
        seen.add(u);
        try {
          const parsed = new URL(u);
          if (/\/blog\/?$/.test(parsed.pathname)) {
            issues.push({ severity: "error", url, path, message: `Person.sameAs must not include section URLs: ${u}` });
          }
        } catch { /* invalid URL already caught by schema.org */ }
      }
    }
  }

  // DefinedTerm forbidden fields
  if (type === "DefinedTerm" && id === CANONICAL_IDS.MR_TERM) {
    for (const field of ["author", "isPartOf", "provider", "producer", "owner", "creator", "sourceOrganization", "sameAs"]) {
      if (Object.prototype.hasOwnProperty.call(node, field)) {
        issues.push({ severity: "error", url, path, message: `MR term node must not have '${field}'` });
      }
    }
    if (!/Coined by Jaxon Parrott/i.test(String(node.description || ""))) {
      issues.push({ severity: "error", url, path, message: "MR term description must include coining attribution" });
    }
  }

  // Coining article validation
  if (id === CANONICAL_IDS.MR_COINING) {
    if (node.author?.["@id"] !== CANONICAL_IDS.JAXON_PERSON) {
      issues.push({ severity: "error", url, path, message: "Coining author must reference Jaxon @id" });
    }
    if (node.about?.["@id"] !== CANONICAL_IDS.MR_TERM) {
      issues.push({ severity: "error", url, path, message: "Coining about must reference MR term @id" });
    }
  }
}

function validateSatelliteIsolation(nodes, url, issues) {
  const hostname = new URL(url).hostname;
  if (!SATELLITE_DOMAINS.has(hostname)) return;

  const atEntityPrefixes = [
    "https://machinerelations.ai/",
    "https://authoritytech.io/",
    "https://jaxonparrott.com/",
    "https://christianlehman.com/",
  ];

  for (const node of nodes) {
    const text = JSON.stringify(node);
    for (const prefix of atEntityPrefixes) {
      if (text.includes(prefix)) {
        issues.push({
          severity: "error",
          url,
          path: `@id=${node["@id"] || "?"}`,
          message: `Satellite site must not reference AT entity domain: ${prefix}`,
        });
        break;
      }
    }
  }
}

// ─── Extraction + Validation Pipeline ───────────────────────────────────────

async function validateUrl(url) {
  const result = {
    url,
    status: "ok",
    schemas: [],
    richResultTypes: [],
    nodeCount: 0,
    issues: [],
  };

  try {
    // Pre-flight HTTP check
    const preflight = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (preflight.status === 404) {
      result.status = "skip";
      result.issues.push({ severity: "info", url, path: "http", message: `404 Not Found — skipping` });
      return result;
    }

    // Self-contained JSON-LD extraction (no external scraping dep):
    // fetch the rendered HTML and pull every <script type="application/ld+json"> block.
    const pageRes = await fetch(url, { redirect: "follow" });
    const html = await pageRes.text();
    const parsedBlocks = [];
    const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const raw = m[1].trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsedBlocks.push(...parsed);
        else parsedBlocks.push(parsed);
      } catch (e) {
        result.issues.push({ severity: "error", url, path: "json-ld", message: `Malformed JSON-LD block: ${e.message}` });
      }
    }
    const jsonldBlocks = { jsonld: parsedBlocks };

    let allNodes = [];
    for (const [, blocks] of Object.entries(jsonldBlocks)) {
      for (const block of blocks) {
        if (block["@graph"]) {
          allNodes.push(...block["@graph"]);
        } else {
          allNodes.push(block);
        }
      }
    }

    result.nodeCount = allNodes.length;

    // Catalog types
    const typeSet = new Set();
    for (const node of allNodes) {
      const t = node["@type"];
      if (Array.isArray(t)) t.forEach((x) => typeSet.add(x));
      else if (t) typeSet.add(t);
    }
    result.schemas = [...typeSet];
    result.richResultTypes = result.schemas.filter((t) => GOOGLE_RICH_RESULT_TYPES.has(t));

    // Validate each node
    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      const path = `node[${i}]<${node["@type"] || "?"}>${node["@id"] ? `#${node["@id"].split("#").pop()}` : ""}`;
      validateNode(node, url, path, result.issues);
      validateSpecCompliance(node, url, path, result.issues, allNodes);
    }

    // Satellite isolation
    validateSatelliteIsolation(allNodes, url, result.issues);

    // Check for @context
    for (const [, blocks] of Object.entries(jsonldBlocks)) {
      for (const block of blocks) {
        if (!block["@context"] || !String(block["@context"]).includes("schema.org")) {
          result.issues.push({ severity: "warning", url, path: "@context", message: "JSON-LD block should have @context referencing schema.org" });
        }
      }
    }

    if (result.issues.some((i) => i.severity === "error")) {
      result.status = "fail";
    } else if (result.issues.some((i) => i.severity === "warning")) {
      result.status = "warn";
    }
  } catch (err) {
    result.status = "error";
    result.issues.push({ severity: "error", url, path: "fetch", message: `Failed to fetch/parse: ${err.message}` });
  }

  return result;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = cliArgs;
const flagJson = args.includes("--json");
const flagAll = args.includes("--all");

let urls = [];

const urlArg = args.find((a, i) => args[i - 1] === "--url");
const siteArg = args.find((a, i) => args[i - 1] === "--site");
// --base overrides a site's production base URL — lets CI validate a locally
// served build (e.g. --site authoritytech.io --base http://localhost:3000)
// so schema errors fail on the pushed code, before it reaches production.
const baseArg = args.find((a, i) => args[i - 1] === "--base");

if (urlArg) {
  urls = [urlArg];
} else if (siteArg) {
  const site = SITES[siteArg];
  if (!site) {
    console.error(`Unknown site: ${siteArg}. Known: ${Object.keys(SITES).join(", ")}`);
    process.exit(1);
  }
  const base = (baseArg || site.base).replace(/\/$/, "");
  urls = site.pages.map((p) => `${base}${p}`);
} else {
  // Default: sample pages from each site
  for (const [, site] of Object.entries(SITES)) {
    const sample = flagAll ? site.pages : site.pages.slice(0, 3);
    urls.push(...sample.map((p) => `${site.base}${p}`));
  }
}

console.error(`\nValidating ${urls.length} URL(s)...\n`);

const results = [];
let errors = 0;
let warnings = 0;

for (const url of urls) {
  const r = await validateUrl(url);
  results.push(r);

  const errCount = r.issues.filter((i) => i.severity === "error").length;
  const warnCount = r.issues.filter((i) => i.severity === "warning").length;
  errors += errCount;
  warnings += warnCount;

  if (!flagJson) {
    const icon = r.status === "ok" ? "✓" : r.status === "warn" ? "⚠" : r.status === "skip" ? "⊘" : "✗";
    const richTag = r.richResultTypes.length > 0 ? ` [rich: ${r.richResultTypes.join(", ")}]` : "";
    console.log(`  ${icon} ${r.url} — ${r.nodeCount} nodes, ${r.schemas.length} types${richTag}`);
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        const sym = issue.severity === "error" ? "    ✗" : "    ⚠";
        console.log(`${sym} ${issue.path}: ${issue.message}`);
      }
    }
  }
}

if (flagJson) {
  console.log(JSON.stringify({ results, summary: { total: urls.length, errors, warnings } }, null, 2));
}

console.error(`\n${results.length} pages checked. ${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) process.exit(1);

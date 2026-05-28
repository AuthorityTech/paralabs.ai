#!/usr/bin/env node
/**
 * validate-ontology-graph.mjs — Para Labs independence firewall validator
 *
 * Para Labs is a judo satellite: an independent AI brand visibility research lab.
 * ANY cross-reference to AuthorityTech, Jaxon, Christian, or Machine Relations
 * entities would undermine its independence positioning.
 *
 * This validator enforces:
 * 1. Required nodes: Organization (paralabs.ai/#organization) + WebSite (paralabs.ai/#website)
 * 2. WebSite.publisher points to Para Labs org
 * 3. Independence firewall: zero references to AT, JP, CL, MR, or Paralax @ids
 * 4. No forbidden entity types: Person, DefinedTerm, Service, SoftwareApplication
 */
import fs from "fs";
import path from "path";
import vm from "node:vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const layout = fs.readFileSync(path.join(ROOT, "src", "app", "layout.tsx"), "utf8");

function fail(message) {
  console.error(`Ontology graph validation failed: ${message}`);
  process.exit(1);
}

function extractSchemaObject(source) {
  const match = source.match(/const schema\s*=\s*({[\s\S]*?});\n\nexport default function RootLayout/);
  if (!match) fail("Unable to find schema object in layout.tsx");
  return match[1];
}

const schema = vm.runInNewContext(
  `(${extractSchemaObject(layout)})`,
  {
    SITE_URL: "https://paralabs.ai",
    SITE_NAME: "Para Labs",
    SITE_TAGLINE: "AI Brand Visibility Lab",
  },
  { timeout: 1000 }
);

const graph = schema?.["@graph"];
if (!Array.isArray(graph)) fail("Schema @graph missing in layout.tsx");

const byId = new Map(
  graph
    .filter((node) => node && typeof node === "object" && typeof node["@id"] === "string")
    .map((node) => [node["@id"], node])
);

// ─── Required nodes ─────────────────────────────────────────────────────────
const org = byId.get("https://paralabs.ai/#organization");
const website = byId.get("https://paralabs.ai/#website");

if (!org) fail("Missing canonical Para Labs organization node (paralabs.ai/#organization)");
if (!website) fail("Missing canonical Para Labs website node (paralabs.ai/#website)");

if (org["@type"] !== "Organization") fail("Para Labs org node must be @type Organization");
if (website["@type"] !== "WebSite") fail("Para Labs website node must be @type WebSite");

// WebSite.publisher must point to Para Labs org
if (website.publisher?.["@id"] !== "https://paralabs.ai/#organization") {
  fail("WebSite.publisher must reference paralabs.ai/#organization");
}

// ─── Independence firewall ──────────────────────────────────────────────────
// Any reference to these domains in the schema is a firewall breach.
const FORBIDDEN_DOMAINS = [
  "authoritytech.io",
  "jaxonparrott.com",
  "christianlehman.com",
  "machinerelations.ai",
  "paralax.ai",
];

const graphText = JSON.stringify(graph);

for (const domain of FORBIDDEN_DOMAINS) {
  if (graphText.includes(domain)) {
    fail(`Independence firewall breach: schema references ${domain}. Para Labs must have zero cross-entity references.`);
  }
}

// ─── Forbidden entity types ─────────────────────────────────────────────────
const FORBIDDEN_TYPES = ["Person", "DefinedTerm", "DefinedTermSet", "Service", "SoftwareApplication"];
for (const node of graph) {
  const nodeType = node?.["@type"];
  if (FORBIDDEN_TYPES.includes(nodeType)) {
    fail(`Forbidden entity type "${nodeType}" found in Para Labs schema. Only Organization + WebSite allowed.`);
  }
}

// ─── Node count sanity ──────────────────────────────────────────────────────
// Para Labs should have exactly 2 nodes: Organization + WebSite
if (graph.length > 2) {
  fail(`Para Labs @graph has ${graph.length} nodes — expected exactly 2 (Organization + WebSite). Extra nodes dilute independence signal.`);
}

console.log("Ontology graph validation passed: Para Labs independence firewall intact.");

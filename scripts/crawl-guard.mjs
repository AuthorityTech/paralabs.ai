#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { machineViewContract } from "./machine-view-contract.mjs";

const ROOT = process.cwd();
function resolveOutDir() {
  const nextApp = path.join(ROOT, ".next", "server", "app");
  const staticOut = path.join(ROOT, "out");
  if (fs.existsSync(path.join(nextApp, "index.md.body"))) return nextApp;
  if (fs.existsSync(path.join(nextApp, "llms.txt.body"))) return nextApp;
  if (fs.existsSync(staticOut)) return staticOut;
  return nextApp;
}

const OUT_DIR = resolveOutDir();
const failures = [];

function fail(location, message) {
  failures.push({ location, message });
}

function readOutput(relativePath, { required = true } = {}) {
  const full = path.join(OUT_DIR, relativePath);
  const body = full + ".body";
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return fs.readFileSync(full, "utf8");
  if (fs.existsSync(body) && fs.statSync(body).isFile()) return fs.readFileSync(body, "utf8");
  if (required) fail(relativePath, "File not found in build output.");
  return "";
}

function routeExists(relativePath) {
  const full = path.join(OUT_DIR, relativePath);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return true;
  if (fs.existsSync(full + ".body")) return true;
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    return fs.existsSync(path.join(full, "route.js"));
  }
  return false;
}

function requireIncludes(content, checks, location) {
  for (const check of checks || []) {
    if (!content.toLowerCase().includes(String(check).toLowerCase())) {
      fail(location, `Missing required text: ${check}`);
    }
  }
}

function validateUrl(location, value) {
  if (typeof value !== "string" || !value.trim()) {
    fail(location, "Missing URL.");
    return;
  }
  try {
    new URL(value);
  } catch {
    fail(location, `Invalid URL: ${JSON.stringify(value)}.`);
    return;
  }
  if (/[][()]/.test(value)) {
    fail(location, `Markdown control character found in URL: ${value}`);
  }
}

function validateMachineLink(location, link) {
  if (!link || typeof link !== "object") {
    fail(location, "Machine link must be an object.");
    return;
  }
  if (typeof link.label !== "string" || !link.label.trim() || /^https?:\/\//.test(link.label)) {
    fail(location, `Bad machine link label: ${JSON.stringify(link.label)}.`);
  }
  validateUrl(`${location}.url`, link.url);
}

function validateMarkdown(location, content) {
  const lines = content.split(/\n/);
  lines.forEach((line, index) => {
    if (/\[[^\]]+\]\([^)\n]*$/.test(line)) {
      fail(location, `Line ${index + 1} has an unterminated markdown link.`);
    }
    if (/https?:\/\/[^\s]+]\(/.test(line)) {
      fail(location, `Line ${index + 1} has a crossed markdown URL/link artifact.`);
    }
    const urlLabel = line.match(/\[(https?:\/\/[^\]]+)\]\(/);
    if (urlLabel) {
      fail(location, `Line ${index + 1} uses a URL as a markdown link label.`);
    }
  });
}

function validateGeneratedMachineSection(location, content) {
  validateMarkdown(location, content);
  requireIncludes(
    content,
    ["Machine-readable related links", "Primary concept:", "Research index:", "Machine manifest:"],
    location,
  );
}

function validateManifest(content, location) {
  let manifest;
  try {
    manifest = JSON.parse(content);
  } catch (error) {
    fail(location, `Invalid JSON: ${error.message}`);
    return;
  }

  const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
  if (routes.length < (machineViewContract.manifest?.minRoutes || 1)) {
    fail(location, `Manifest route count too low: ${routes.length}.`);
  }

  routes.forEach((route, index) => {
    const routeLocation = `${location}.routes[${index}]`;
    validateUrl(`${routeLocation}.url`, route?.url);
    validateUrl(`${routeLocation}.markdownUrl`, route?.markdownUrl);
    if (typeof route?.title !== "string" || !route.title.trim()) {
      fail(routeLocation, "Missing title.");
    }
    if (typeof route?.summary !== "string" || !route.summary.trim()) {
      fail(routeLocation, "Missing summary.");
    }

    const generatedLinks = [
      route?.primaryConcept,
      ...(Array.isArray(route?.relatedConcepts) ? route.relatedConcepts : []),
      ...(Array.isArray(route?.relatedResearch) ? route.relatedResearch : []),
      ...(Array.isArray(route?.supportLinks) ? route.supportLinks : []),
    ].filter(Boolean);

    if (!generatedLinks.length) {
      fail(routeLocation, "No generated machine links.");
    }

    generatedLinks.forEach((link, linkIndex) => {
      validateMachineLink(`${routeLocation}.links[${linkIndex}]`, link);
    });

    if (Array.isArray(route?.sourceUrls)) {
      route.sourceUrls.forEach((url, sourceIndex) => validateUrl(`${routeLocation}.sourceUrls[${sourceIndex}]`, url));
    }
  });
}

function validateXmlSitemap(content, location, required = []) {
  requireIncludes(content, ['<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'], location);
  requireIncludes(content, required, location);
  const locs = [...content.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (!locs.length) {
    fail(location, "Sitemap contains no <loc> entries.");
  }
  locs.forEach((loc, index) => validateUrl(`${location}.loc[${index}]`, loc));
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    data[pair[1]] = pair[2].replace(/^['"]|['"]$/g, "").trim();
  }
  return data;
}

function slugFromFile(file, data) {
  if (data.slug) return data.slug;
  return file.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

if (!fs.existsSync(OUT_DIR)) {
  console.error("crawl-guard: build output not found. Run npm run build first.");
  process.exit(1);
}

for (const page of machineViewContract.staticMarkdown || []) {
  const content = readOutput(page.path);
  if (!content) continue;
  validateGeneratedMachineSection(page.path, content);
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes < page.minBytes) {
    fail(page.path, `Machine markdown too thin: ${bytes} < ${page.minBytes} bytes.`);
  }
  requireIncludes(content, page.required, page.path);
}

if (machineViewContract.llms) {
  const llms = readOutput(machineViewContract.llms.path);
  if (llms) {
    validateMarkdown(machineViewContract.llms.path, llms);
    requireIncludes(llms, machineViewContract.llms.required, machineViewContract.llms.path);
  }
}

if (machineViewContract.manifest) {
  const manifest = readOutput(machineViewContract.manifest.path);
  if (manifest) validateManifest(manifest, machineViewContract.manifest.path);
}

if (machineViewContract.machineSitemap) {
  const machineSitemap = readOutput(machineViewContract.machineSitemap.path);
  if (machineSitemap) {
    validateXmlSitemap(
      machineSitemap,
      machineViewContract.machineSitemap.path,
      machineViewContract.machineSitemap.required,
    );
  }
}

for (const collection of machineViewContract.contentCollections || []) {
  const dir = path.join(ROOT, collection.dir);
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith(".md") && !name.startsWith("_")).sort()
    : [];
  if (!files.length) {
    fail(collection.dir, "No markdown content files found for sample route check.");
    continue;
  }
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ROOT, collection.dir, file), "utf8");
    const data = parseFrontmatter(raw);
    const slug = slugFromFile(file, data);
    const routePath = `${collection.routePrefix}/${slug}`;
    if (!routeExists(routePath)) {
      fail(routePath, "Dynamic markdown route missing in build output.");
      continue;
    }
    const rendered = readOutput(routePath, { required: false });
    if (rendered && data.title) requireIncludes(rendered, [data.title], routePath);
    if (rendered) validateGeneratedMachineSection(routePath, rendered);
  }
}

const robots = readOutput("robots.txt", { required: false });
if (robots) {
  requireIncludes(robots, ["/blog-md/", "/machine-manifest.json", "/machine-sitemap.xml"], "robots.txt");
  if (/Disallow:\s*\/blog-md\//i.test(robots) || /Disallow:\s*\/machine-manifest\.json/i.test(robots)) {
    fail("robots.txt", "Machine-readable routes must not be disallowed.");
  }
}

if (failures.length) {
  console.error(`crawl-guard failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- [${failure.location}] ${failure.message}`);
  process.exit(1);
}

console.log("crawl-guard: machine-readable build output verified.");

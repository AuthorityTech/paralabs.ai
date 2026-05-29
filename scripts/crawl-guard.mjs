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

function newestMarkdownFile(relativeDir) {
  const dir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".md") && !name.startsWith("_")).sort();
  return files.at(-1) || null;
}

if (!fs.existsSync(OUT_DIR)) {
  console.error("crawl-guard: build output not found. Run npm run build first.");
  process.exit(1);
}

for (const page of machineViewContract.staticMarkdown || []) {
  const content = readOutput(page.path);
  if (!content) continue;
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes < page.minBytes) {
    fail(page.path, `Machine markdown too thin: ${bytes} < ${page.minBytes} bytes.`);
  }
  requireIncludes(content, page.required, page.path);
}

if (machineViewContract.llms) {
  const llms = readOutput(machineViewContract.llms.path);
  if (llms) requireIncludes(llms, machineViewContract.llms.required, machineViewContract.llms.path);
}

for (const collection of machineViewContract.contentCollections || []) {
  const file = newestMarkdownFile(collection.dir);
  if (!file) {
    fail(collection.dir, "No markdown content files found for sample route check.");
    continue;
  }
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
}

const robots = readOutput("robots.txt", { required: false });
if (robots) requireIncludes(robots, ["/blog-md/"], "robots.txt");

if (failures.length) {
  console.error(`crawl-guard failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- [${failure.location}] ${failure.message}`);
  process.exit(1);
}

console.log("crawl-guard: machine-readable build output verified.");

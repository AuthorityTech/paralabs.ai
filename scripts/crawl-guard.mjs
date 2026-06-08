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

function validateCanonicalImageAsset(location, asset) {
  if (!asset || typeof asset !== "object") {
    fail(location, "Canonical image asset must be an object.");
    return;
  }

  validateUrl(`${location}.canonicalPageUrl`, asset.canonicalPageUrl);
  validateUrl(`${location}.imageUrl`, asset.imageUrl);

  if (!Number.isInteger(asset.width) || asset.width <= 0) {
    fail(location, `Bad image width: ${JSON.stringify(asset.width)}.`);
  }
  if (!Number.isInteger(asset.height) || asset.height <= 0) {
    fail(location, `Bad image height: ${JSON.stringify(asset.height)}.`);
  }
  if (typeof asset.alt !== "string" || !asset.alt.trim()) {
    fail(location, "Missing image alt text.");
  }
  if (typeof asset.bucket !== "string" || !asset.bucket.trim()) {
    fail(location, "Missing image policy bucket.");
  }
  if (typeof asset.routeFamily !== "string" || !asset.routeFamily.trim()) {
    fail(location, "Missing image route family.");
  }
  if (!["attach-to-canonical-page", "metadata-only"].includes(asset.searchPolicy)) {
    fail(location, `Bad image search policy: ${JSON.stringify(asset.searchPolicy)}.`);
  }
  if (!["primary-image-of-page", "none"].includes(asset.schemaPolicy)) {
    fail(location, `Bad image schema policy: ${JSON.stringify(asset.schemaPolicy)}.`);
  }

  if (
    asset.routeFamily === "blog-generated-opengraph-image" &&
    asset.imageUrl !== `${asset.canonicalPageUrl}/opengraph-image`
  ) {
    fail(location, "Blog generated image must be attached to its canonical post URL.");
  }
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

    if (route?.primaryImage) {
      validateCanonicalImageAsset(`${routeLocation}.primaryImage`, route.primaryImage);
      if (route.primaryImage.canonicalPageUrl !== route.url) {
        fail(`${routeLocation}.primaryImage`, "Primary image canonicalPageUrl must match the owning route URL.");
      }
    }
  });

  if (Array.isArray(manifest.imageAssets)) {
    manifest.imageAssets.forEach((asset, index) => {
      validateCanonicalImageAsset(`${location}.imageAssets[${index}]`, asset);
    });
  }
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

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseUrlSitemapEntries(content, location) {
  const entries = [...content.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match, index) => {
    const block = match[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
    const images = [...block.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((imageMatch) => decodeXml(imageMatch[1]));
    if (!locMatch) fail(`${location}.url[${index}]`, "Missing page <loc>.");
    return {
      index,
      loc: locMatch ? decodeXml(locMatch[1]) : "",
      images,
    };
  });

  if (/<image:/.test(content) && !/xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/.test(content)) {
    fail(location, "Image sitemap tags require the Google image sitemap namespace.");
  }

  return entries;
}

function urlPath(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function hasForbiddenStandaloneLoc(loc, forbiddenSubstrings = []) {
  const pathOnly = urlPath(loc).toLowerCase();
  return forbiddenSubstrings.some((forbidden) => pathOnly.includes(String(forbidden).toLowerCase()));
}

function listKnownPostSlugs() {
  const postsDir = path.join(ROOT, "content/posts");
  if (!fs.existsSync(postsDir)) return [];
  return fs.readdirSync(postsDir)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(postsDir, file), "utf8");
      return slugFromFile(file, parseFrontmatter(raw));
    })
    .sort();
}

function validateImageAssetSitemaps(policy) {
  if (!policy) return;

  const sitemapEntries = new Map();
  for (const sitemapPath of policy.humanSitemaps || []) {
    const content = readOutput(sitemapPath);
    if (!content) continue;
    const entries = parseUrlSitemapEntries(content, sitemapPath);
    sitemapEntries.set(sitemapPath, entries);

    entries.forEach((entry) => {
      validateUrl(`${sitemapPath}.url[${entry.index}].loc`, entry.loc);
      if (hasForbiddenStandaloneLoc(entry.loc, policy.forbiddenStandaloneLocSubstrings)) {
        fail(
          `${sitemapPath}.url[${entry.index}].loc`,
          `Human sitemap loc must be a canonical page URL, not an image/generated route: ${entry.loc}`,
        );
      }

      entry.images.forEach((imageLoc, imageIndex) => {
        validateUrl(`${sitemapPath}.url[${entry.index}].image[${imageIndex}]`, imageLoc);
        if (!entry.loc || hasForbiddenStandaloneLoc(entry.loc, policy.forbiddenStandaloneLocSubstrings)) {
          fail(`${sitemapPath}.url[${entry.index}].image[${imageIndex}]`, "Image sitemap entry is not attached to a canonical page loc.");
        }
        if (urlPath(imageLoc).startsWith("/images/") && !(policy.allowedStaticImageUrls || []).includes(imageLoc)) {
          fail(`${sitemapPath}.url[${entry.index}].image[${imageIndex}]`, `Static public image is not selected by policy: ${imageLoc}`);
        }
      });
    });
  }

  const pagesEntries = sitemapEntries.get("pages/sitemap.xml") || [];
  const homeEntry = pagesEntries.find((entry) => entry.loc === policy.homeImage?.pageLoc);
  if (!homeEntry) {
    fail("pages/sitemap.xml", `Missing home page loc: ${policy.homeImage?.pageLoc}`);
  } else if (
    policy.homeImage.searchPolicy === "attach-to-canonical-page" &&
    !homeEntry.images.includes(policy.homeImage.imageLoc)
  ) {
    fail("pages/sitemap.xml", `Home page loc must attach selected image: ${policy.homeImage.imageLoc}`);
  } else if (policy.homeImage.searchPolicy === "metadata-only" && homeEntry.images.includes(policy.homeImage.imageLoc)) {
    fail("pages/sitemap.xml", `Metadata-only home image must not be attached in sitemap: ${policy.homeImage.imageLoc}`);
  }

  const knownSlugs = new Set(listKnownPostSlugs());
  const seenBlogSlugs = new Set();
  const blogEntries = sitemapEntries.get("blog/sitemap.xml") || [];
  for (const entry of blogEntries) {
    const pathname = urlPath(entry.loc);
    if (pathname === "/blog") {
      if (entry.images.length) fail("blog/sitemap.xml", "Blog index must not attach generated post images.");
      continue;
    }

    const postMatch = pathname.match(/^\/blog\/([^/]+)$/);
    if (!postMatch) continue;

    const slug = postMatch[1];
    if (!knownSlugs.has(slug)) {
      fail("blog/sitemap.xml", `Blog sitemap includes unknown post slug: ${slug}`);
      continue;
    }

    seenBlogSlugs.add(slug);
    const expectedImage = `${entry.loc}${policy.blogPostImageSuffix}`;
    if (entry.images.length !== 1 || entry.images[0] !== expectedImage) {
      fail("blog/sitemap.xml", `Blog post ${slug} must attach exactly ${expectedImage}`);
    }
  }

  for (const slug of knownSlugs) {
    if (!seenBlogSlugs.has(slug)) {
      fail("blog/sitemap.xml", `Known post slug missing from blog sitemap image policy check: ${slug}`);
    }
  }

  const generated = policy.generatedBlogOpenGraph;
  if (generated?.sourceFile) {
    const sourcePath = path.join(ROOT, generated.sourceFile);
    if (!fs.existsSync(sourcePath)) {
      fail(generated.sourceFile, "Generated OpenGraph image source file is missing.");
    } else {
      const source = fs.readFileSync(sourcePath, "utf8");
      for (const required of generated.requiredSourceText || []) {
        if (!source.includes(required)) {
          fail(generated.sourceFile, `Missing generated image bound/content-type source check: ${required}`);
        }
      }
    }
  }
}

function validateHumanSitemapIndex(content, location, required = [], forbidden = []) {
  requireIncludes(content, ['<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'], location);
  requireIncludes(content, required, location);
  for (const forbiddenText of forbidden) {
    if (content.includes(forbiddenText)) {
      fail(location, `Human sitemap index must not include machine alternate: ${forbiddenText}`);
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

if (machineViewContract.humanSitemapIndex) {
  const humanSitemapIndex = readOutput(machineViewContract.humanSitemapIndex.path);
  if (humanSitemapIndex) {
    validateHumanSitemapIndex(
      humanSitemapIndex,
      machineViewContract.humanSitemapIndex.path,
      machineViewContract.humanSitemapIndex.required,
      machineViewContract.humanSitemapIndex.forbidden,
    );
  }
}

validateImageAssetSitemaps(machineViewContract.imageAssetPolicy);

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
  requireIncludes(robots, ["/sitemap.xml", "/blog/sitemap.xml", "/pages/sitemap.xml"], "robots.txt");
  if (/Sitemap:\s*https:\/\/paralabs\.ai\/machine-sitemap\.xml/i.test(robots)) {
    fail("robots.txt", "Machine sitemap must not be advertised as a search-engine Sitemap.");
  }
  if (/Disallow:\s*\/blog-md\//i.test(robots) || /Disallow:\s*\/machine-manifest\.json/i.test(robots) || /Disallow:\s*\/machine-sitemap\.xml/i.test(robots)) {
    fail("robots.txt", "Machine-readable routes should stay fetchable for agents.");
  }
}

if (failures.length) {
  console.error(`crawl-guard failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- [${failure.location}] ${failure.message}`);
  process.exit(1);
}

console.log("crawl-guard: machine-readable build output verified.");

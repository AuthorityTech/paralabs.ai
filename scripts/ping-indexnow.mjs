#!/usr/bin/env node
/**
 * ping-indexnow.mjs
 *
 * Notifies IndexNow-compatible search engines (Bing, Yandex, etc.)
 * when blog content changes.
 *
 * Usage:
 *   node scripts/ping-indexnow.mjs          # auto-detect via git diff
 *   node scripts/ping-indexnow.mjs --all    # submit every post URL
 *   node scripts/ping-indexnow.mjs --urls https://paralabs.ai/blog/my-post
 */

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const KEY = "e865ee49880a220d1cb170ccfe089a15";
const HOST = "paralabs.ai";
const BASE = `https://${HOST}`;
const KEY_LOCATION = `${BASE}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a content/posts filename to a blog URL. */
function postFileToUrl(filename) {
  // content/posts/YYYY-MM-DD-{slug}.md  ->  /blog/{slug}
  const base = filename.replace(/^content\/posts\//, "").replace(/\.md$/, "");
  // Strip the leading date prefix: "2026-03-01-my-slug" -> "my-slug"
  const slug = base.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return `${BASE}/blog/${slug}`;
}

/** Run a git command and return stdout, or null on failure. */
function git(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// URL collection strategies
// ---------------------------------------------------------------------------

function urlsFromGitDiff() {
  const diff = git("git diff --name-only HEAD~1 HEAD");
  if (!diff) return null; // shallow clone or no history

  const files = diff.split("\n").filter(Boolean);
  const postFiles = files.filter((f) => f.startsWith("content/posts/") && f.endsWith(".md"));

  if (postFiles.length === 0) {
    console.log("No post changes detected in last commit.");
    return [];
  }

  const urls = postFiles.map(postFileToUrl);
  // Also submit the blog listing page so engines re-crawl it.
  urls.push(`${BASE}/blog`);
  return urls;
}

function urlsFromGitLsFiles() {
  console.log("Falling back to git ls-files (shallow clone detected).");
  const ls = git("git ls-files -- content/posts/");
  if (!ls) return [];

  const files = ls.split("\n").filter(Boolean);
  const urls = files.map(postFileToUrl);
  urls.push(`${BASE}/blog`);
  return urls;
}

function urlsFromAllPosts() {
  const postsDir = resolve(ROOT, "content/posts");
  const files = readdirSync(postsDir).filter((f) => f.endsWith(".md"));
  const urls = files.map((f) => postFileToUrl(`content/posts/${f}`));
  urls.push(`${BASE}/blog`);
  return urls;
}

function urlsFromFlag(raw) {
  // --urls can be space-separated or comma-separated
  return raw
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  let urls;

  if (args.includes("--all")) {
    console.log("Submitting all post URLs.");
    urls = urlsFromAllPosts();
  } else if (args.includes("--urls")) {
    const idx = args.indexOf("--urls");
    const raw = args.slice(idx + 1).join(" ");
    if (!raw) {
      console.error("--urls requires at least one URL argument.");
      process.exit(1);
    }
    urls = urlsFromFlag(raw);
  } else {
    // Auto-detect from git diff, fallback to ls-files
    urls = urlsFromGitDiff() ?? urlsFromGitLsFiles();
  }

  if (urls.length === 0) {
    console.log("Nothing to submit. Exiting.");
    return;
  }

  // Deduplicate
  urls = [...new Set(urls)];

  console.log(`Submitting ${urls.length} URL(s) to IndexNow:`);
  urls.forEach((u) => console.log(`  ${u}`));

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 202) {
    console.log(`IndexNow accepted (HTTP ${res.status}).`);
  } else {
    const text = await res.text().catch(() => "");
    console.error(`IndexNow rejected (HTTP ${res.status}): ${text}`);
    process.exit(1);
  }
}

main();
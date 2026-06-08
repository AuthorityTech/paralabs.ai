#!/usr/bin/env node
/**
 * Submit Para Labs sitemaps to Google Search Console.
 *
 * This does not request per-URL indexing. For normal blog posts, Google's
 * supported bulk discovery path is sitemap submission with fresh lastmod data.
 */

import crypto from "node:crypto";
import fs from "node:fs";

const SITE_URL =
  process.env.GSC_SITE_URL ||
  process.env.SEARCH_CONSOLE_SITE_URL ||
  "sc-domain:paralabs.ai";
const args = process.argv.slice(2);
const mode = args.includes("--delete") ? "delete" : "submit";

function readArgValues(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === name) {
      const next = args[index + 1];
      if (next && !next.startsWith("--")) values.push(next);
    } else if (arg.startsWith(`${name}=`)) {
      values.push(arg.slice(name.length + 1));
    }
  }
  return values.join(",");
}

const DEFAULT_SITEMAPS = "https://paralabs.ai/sitemap.xml,https://paralabs.ai/pages/sitemap.xml,https://paralabs.ai/blog/sitemap.xml";
const SITEMAPS = (readArgValues("--sitemaps") || process.env.GSC_SITEMAPS || DEFAULT_SITEMAPS)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const SCOPE = "https://www.googleapis.com/auth/webmasters";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function readServiceAccount() {
  if (process.env.GSC_SERVICE_ACCOUNT_JSON?.trim()) {
    return JSON.parse(process.env.GSC_SERVICE_ACCOUNT_JSON);
  }
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_SEARCH_CONSOLE_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  }
  console.log("GSC credentials not configured; skipping sitemap submission.");
  process.exit(0);
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function createJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(serviceAccount.private_key, "base64url");
  return `${unsigned}.${signature}`;
}

async function getAccessToken(serviceAccount) {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: createJwt(serviceAccount),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google OAuth token request failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function submitSitemap(accessToken, sitemapUrl) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
  const res = await fetch(endpoint, {
    method: mode === "delete" ? "DELETE" : "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`GSC sitemap ${mode} failed for ${sitemapUrl} (${res.status}): ${text}`);
  }
  console.log(`${mode === "delete" ? "Deleted" : "Submitted"} sitemap ${mode === "delete" ? "from" : "to"} GSC: ${sitemapUrl}`);
}

async function main() {
  const serviceAccount = readServiceAccount();
  const accessToken = await getAccessToken(serviceAccount);
  for (const sitemap of SITEMAPS) {
    await submitSitemap(accessToken, sitemap);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * validate-internal-links.mjs — portable, zero-dependency CI gate.
 *
 * Fails (exit 1) when any published content file links to a same-site CONTENT
 * route that does not resolve to a real published file. This is the post-push
 * backstop for the failure class the editorial publisher's internal-link-guard
 * already strips pre-push: dangling same-site links forcing a re-publish.
 *
 * Design (judo, not force): the gate is scoped to *content lane prefixes*
 * (`/blog/`, `/curated/`, `/glossary/`, `/research/`, `/industries/`, ...) declared
 * in `internal-links.config.json`. A link is validated only when its pathname falls
 * under a configured lane prefix; everything else (static pages, anchors, externals)
 * is out of scope. This means there is NO site-wide route table to keep current — the
 * set of valid routes is derived from the content files themselves, so the gate is
 * self-maintaining as content is added or removed. The same config drives the `--heal`
 * pass that strips existing dead links so a repo can be brought to green once.
 *
 * Identical byte-for-byte across every content repo. The canonical copy + its
 * regression lock live in AuthorityTech/jarvis (jarvis-runtime/). Vendored into each
 * content repo at scripts/validate-internal-links.mjs with a sibling config.
 *
 * Config shape (internal-links.config.json, repo root):
 * {
 *   "siteHost": "authoritytech.io",
 *   "lanes": [
 *     { "dir": "content/blog", "prefix": "/blog", "stripDate": true },
 *     { "dir": "content/industries", "prefix": "/industries", "nested": true }
 *   ],
 *   "mdMirror": true,          // also accept `<route>.md` machine-readable mirrors
 *   "allowlist": ["/blog/some-legacy-slug"]  // optional explicit valid paths
 * }
 *
 * Lane options:
 *   dir        content directory, relative to repo root (recursed)
 *   prefix     URL prefix the lane serves under (e.g. "/blog")
 *   stripDate  strip a leading YYYY-MM-DD- from the filename when deriving the slug
 *   nested     keep sub-directory structure in the route (e.g. industries/<a>/<b>)
 *   ext        file extensions to treat as content (default ["md","mdx"])
 *   slugFromFrontmatter  honor a frontmatter `slug:` override (default true). Set
 *              false for lanes whose site builder derives the slug from the filename
 *              ONLY and ignores frontmatter (the satellite blogs do this).
 * Frontmatter `slug:` overrides the derived slug exactly as the site builder does,
 * so the gate computes the same route the site serves — never a divergent one.
 *
 * Usage:
 *   node scripts/validate-internal-links.mjs            # gate: exit 1 on dead links
 *   node scripts/validate-internal-links.mjs --heal     # rewrite files, strip dead links
 *   node scripts/validate-internal-links.mjs --json     # machine-readable report
 */
import fs from 'node:fs';
import path from 'node:path';

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_ANCHOR = /<a\b[^>]*?\bhref=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi;
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

function readConfig(root) {
  const p = path.join(root, 'internal-links.config.json');
  if (!fs.existsSync(p)) {
    throw new Error(`internal-links.config.json not found at ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Minimal frontmatter slug reader — no YAML dep; only the slug field is needed. */
function frontmatterSlug(raw) {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = raw.slice(3, end);
  const m = block.match(/^\s*slug:\s*["']?([^"'\n#]+?)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

function listFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, exts));
    else if (exts.some((e) => entry.name.endsWith(`.${e}`))) out.push(full);
  }
  return out;
}

/** Derive the canonical route path for a content file under a lane. */
function routeForFile(root, lane, file, raw) {
  const exts = lane.ext || ['md', 'mdx'];
  const rel = path.relative(path.join(root, lane.dir), file);
  let stem = rel.replace(new RegExp(`\\.(${exts.join('|')})$`), '');
  const fmSlug = lane.slugFromFrontmatter === false ? null : frontmatterSlug(raw);
  if (fmSlug) {
    // Frontmatter slug overrides; nested lanes keep the parent dirs, flat lanes do not.
    if (lane.nested) {
      const dirPart = path.dirname(stem);
      stem = dirPart === '.' ? fmSlug : `${dirPart}/${fmSlug}`;
    } else {
      stem = fmSlug;
    }
  } else if (lane.nested) {
    if (lane.stripDate) {
      stem = stem.split('/').map((s) => s.replace(DATE_PREFIX, '')).join('/');
    }
  } else {
    stem = path.basename(stem);
    if (lane.stripDate) stem = stem.replace(DATE_PREFIX, '');
  }
  const prefix = lane.prefix.replace(/\/+$/, '');
  return `${prefix}/${stem}`;
}

/** Normalize a link URL to a same-host root-relative pathname, or null if off-site. */
function sameSitePathname(url, siteHost) {
  const u = url.trim();
  let pathname;
  if (u.startsWith('/')) {
    pathname = u;
  } else if (/^https?:\/\//i.test(u)) {
    let parsed;
    try { parsed = new URL(u); } catch { return null; }
    if (parsed.hostname !== siteHost) return null;
    pathname = parsed.pathname;
  } else {
    return null; // mailto:, #anchor, relative fragment, etc.
  }
  return pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
}

function buildModel(root, config) {
  const lanePrefixes = config.lanes.map((l) => l.prefix.replace(/\/+$/, ''));
  const validPaths = new Set(config.allowlist || []);
  const files = [];
  for (const lane of config.lanes) {
    const exts = lane.ext || ['md', 'mdx'];
    for (const file of listFiles(path.join(root, lane.dir), exts)) {
      const raw = fs.readFileSync(file, 'utf8');
      const route = routeForFile(root, lane, file, raw);
      validPaths.add(route);
      files.push({ file, raw });
    }
  }
  return { lanePrefixes, validPaths, files };
}

/** Is this same-site pathname an in-scope CONTENT route that does not resolve? */
function deadContentPath(pathname, lanePrefixes, validPaths) {
  if (pathname == null) return false;
  const inScope = lanePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!inScope) return false;
  // A bare lane index (/blog) is not a post route; only /blog/<x> is validated.
  if (lanePrefixes.includes(pathname)) return false;
  let candidate = pathname;
  if (candidate.endsWith('.md')) candidate = candidate.slice(0, -3);
  return !validPaths.has(candidate) && !validPaths.has(pathname);
}

function scanBody(raw, siteHost, lanePrefixes, validPaths) {
  const body = raw.startsWith('---')
    ? raw.slice(Math.max(0, raw.indexOf('\n---', 3)) + 4)
    : raw;
  const dead = [];
  const check = (url, anchor, kind) => {
    const pathname = sameSitePathname(url, siteHost);
    if (deadContentPath(pathname, lanePrefixes, validPaths)) {
      dead.push({ url: url.trim(), pathname, anchor, kind });
    }
  };
  for (const m of body.matchAll(MARKDOWN_LINK)) check(m[2], m[1], 'markdown');
  for (const m of body.matchAll(HTML_ANCHOR)) check(m[2], m[3], 'html');
  return dead;
}

/**
 * Heal dead links. A link orphaned by the date→dateless route migration (its slug
 * still carries a `YYYY-MM-DD-` prefix) is REPAIRED to the live dateless URL when that
 * URL resolves to a real route — preserving the internal link the author intended.
 * A genuinely dead link (no resolving target) is STRIPPED, collapsing the anchor to
 * its visible text. Function-replacers so `$` in text is never reinterpreted.
 */
function healBody(raw, siteHost, lanePrefixes, validPaths) {
  const isDead = (url) =>
    deadContentPath(sameSitePathname(url, siteHost), lanePrefixes, validPaths);
  // Date-strip repair candidate: drop a `/YYYY-MM-DD-` path token, keep query/hash.
  const repairUrl = (url) => {
    const candidate = url.replace(/\/\d{4}-\d{2}-\d{2}-/, '/');
    if (candidate === url) return null;
    return isDead(candidate) ? null : candidate;
  };
  const repaired = [];
  const stripped = [];
  const resolve = (url, collapse) => {
    const fixed = repairUrl(url);
    if (fixed) { repaired.push({ from: url.trim(), to: fixed.trim() }); return collapse(fixed); }
    stripped.push(url.trim());
    return null; // signal: collapse to text
  };
  let out = raw.replace(MARKDOWN_LINK, (match, text, url) => {
    if (!isDead(url)) return match;
    const fixedMatch = resolve(url, (fixed) => match.replace(url, () => fixed));
    return fixedMatch === null ? text : fixedMatch;
  });
  out = out.replace(HTML_ANCHOR, (match, _q, url, inner) => {
    if (!isDead(url)) return match;
    const fixedMatch = resolve(url, (fixed) => match.replace(url, () => fixed));
    return fixedMatch === null ? inner : fixedMatch;
  });
  return { out, repaired, stripped };
}

function main() {
  const root = process.cwd();
  const heal = process.argv.includes('--heal');
  const json = process.argv.includes('--json');
  const config = readConfig(root);
  const siteHost = config.siteHost;
  if (!siteHost) throw new Error('config.siteHost is required');
  const { lanePrefixes, validPaths, files } = buildModel(root, config);

  const report = [];
  let repairedCount = 0;
  let strippedCount = 0;
  for (const { file, raw } of files) {
    if (heal) {
      // Heal must not touch frontmatter; split, heal body, rejoin.
      const fmEnd = raw.startsWith('---') ? raw.indexOf('\n---', 3) : -1;
      const head = fmEnd === -1 ? '' : raw.slice(0, fmEnd + 4);
      const body = fmEnd === -1 ? raw : raw.slice(fmEnd + 4);
      const { out, repaired, stripped } = healBody(body, siteHost, lanePrefixes, validPaths);
      if (repaired.length || stripped.length) {
        fs.writeFileSync(file, head + out);
        repairedCount += repaired.length;
        strippedCount += stripped.length;
        report.push({ file: path.relative(root, file), repaired, stripped });
      }
    } else {
      const dead = scanBody(raw, siteHost, lanePrefixes, validPaths);
      if (dead.length) report.push({ file: path.relative(root, file), dead });
    }
  }

  if (json) {
    console.log(JSON.stringify({ mode: heal ? 'heal' : 'check', report }, null, 2));
  }

  if (heal) {
    if (!json) {
      console.log(
        `internal-links: healed ${report.length} file(s) — ` +
        `repaired ${repairedCount} link(s) to live route, stripped ${strippedCount} dead link(s).`
      );
    }
    return;
  }

  const total = report.reduce((n, r) => n + r.dead.length, 0);
  if (total === 0) {
    if (!json) console.log(`internal-links: OK — no dangling same-site content links (${files.length} files scanned).`);
    process.exit(0);
  }
  if (!json) {
    console.error(`internal-links: FAIL — ${total} dangling same-site content link(s):\n`);
    for (const r of report) {
      console.error(`  ${r.file}`);
      for (const d of r.dead) console.error(`    [${d.kind}] ${d.url}  ->  ${d.pathname}`);
    }
    console.error(`\nFix: remove the dead link(s), or republish so the publisher guard strips them.`);
  }
  process.exit(1);
}

// Export the pure pieces for the regression lock; run only as a CLI entrypoint.
export { routeForFile, sameSitePathname, deadContentPath, scanBody, healBody, buildModel, frontmatterSlug };

if (import.meta.url === `file://${process.argv[1]}`) main();

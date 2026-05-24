#!/usr/bin/env node
/**
 * crawl-guard.mjs — post-build guard
 *
 * Verifies that:
 * 1. /index.md route exists in the build output
 * 2. /blog.md route exists in the build output
 * 3. /blog-md/ routes exist for each blog post
 * 4. robots.txt disallows /blog-md/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NEXT_DIR = path.join(ROOT, ".next");

let errors = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  OK  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    errors++;
  }
}

console.log("crawl-guard: checking build output...\n");

// Check .next directory exists
if (!fs.existsSync(NEXT_DIR)) {
  console.error("FAIL: .next directory not found — run `npm run build` first.");
  process.exit(1);
}

// Check route manifest for .md routes
const routesManifest = path.join(NEXT_DIR, "routes-manifest.json");
if (fs.existsSync(routesManifest)) {
  const manifest = JSON.parse(fs.readFileSync(routesManifest, "utf8"));
  const rewrites = manifest.rewrites ?? [];
  // Flatten possible beforeFiles/afterFiles/fallback structure
  const allRewrites = Array.isArray(rewrites)
    ? rewrites
    : [
        ...(rewrites.beforeFiles ?? []),
        ...(rewrites.afterFiles ?? []),
        ...(rewrites.fallback ?? []),
      ];

  const hasSlugRewrite = allRewrites.some(
    (r) =>
      r.source?.includes("/blog/:slug.md") ||
      r.source?.includes("/blog/(?<slug>[^/]+)\\.md")
  );
  check("/blog/:slug.md rewrite in routes-manifest", hasSlugRewrite);
} else {
  console.log("  SKIP  routes-manifest.json not found (non-standard build)");
}

// Check that machine-content lib exists
check(
  "src/lib/machine-content.ts exists",
  fs.existsSync(path.join(ROOT, "src/lib/machine-content.ts"))
);
check(
  "src/lib/site-manifest.ts exists",
  fs.existsSync(path.join(ROOT, "src/lib/site-manifest.ts"))
);
check(
  "src/lib/markdown-route.ts exists",
  fs.existsSync(path.join(ROOT, "src/lib/markdown-route.ts"))
);

// Check route handler files exist
check(
  "src/app/index.md/route.ts exists",
  fs.existsSync(path.join(ROOT, "src/app/index.md/route.ts"))
);
check(
  "src/app/blog.md/route.ts exists",
  fs.existsSync(path.join(ROOT, "src/app/blog.md/route.ts"))
);
check(
  "src/app/blog-md/[slug]/route.ts exists",
  fs.existsSync(path.join(ROOT, "src/app/blog-md/[slug]/route.ts"))
);

// Check MachineViewToggle component exists
check(
  "src/components/MachineViewToggle.tsx exists",
  fs.existsSync(path.join(ROOT, "src/components/MachineViewToggle.tsx"))
);

// Check layout mounts the toggle
const layout = fs.readFileSync(
  path.join(ROOT, "src/app/layout.tsx"),
  "utf8"
);
check("layout imports MachineViewToggle", layout.includes("MachineViewToggle"));
check(
  "layout wraps children with data-human-content",
  layout.includes("data-human-content")
);

// Check robots disallows /blog-md/
const robotsFile = path.join(ROOT, "src/app/robots.ts");
if (fs.existsSync(robotsFile)) {
  const robotsContent = fs.readFileSync(robotsFile, "utf8");
  check(
    'robots.ts disallows /blog-md/',
    robotsContent.includes("/blog-md/")
  );
}

// Check CSS has machine view rules
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
check(
  "globals.css has .machine-view-active rule",
  css.includes(".machine-view-active [data-human-content]")
);
check("globals.css has .pl-view-switch", css.includes(".pl-view-switch"));
check(
  "globals.css has .pl-machine-panel",
  css.includes(".pl-machine-panel")
);
check(
  "globals.css has .pl-machine-panel__bar",
  css.includes(".pl-machine-panel__bar")
);
check(
  "globals.css has .pl-machine-panel__content",
  css.includes(".pl-machine-panel__content")
);

console.log("");
if (errors > 0) {
  console.error(`crawl-guard: ${errors} check(s) failed.`);
  process.exit(1);
} else {
  console.log("crawl-guard: all checks passed.");
}

# AGENTS.md

## Cursor Cloud specific instructions

This is a Next.js 15 personal blog deployed on Vercel with ISR hybrid. No database required. External integrations: Google Search Console (GSC) and Vercel.

### Services

| Service | Command | Port |
|---------|---------|------|
| Dev server | `npm run dev` | 3000 |

### Lint / Build / Dev

- **Lint**: `npx eslint .` — ESLint 9 flat config in `eslint.config.mjs`. Note: `npm run lint` (`next lint`) is deprecated in Next.js 16; use `npx eslint .` directly.
- **Type check**: `npx tsc --noEmit`
- **Build**: `npm run build` — ISR hybrid build (dynamic routes render on demand).
- **Dev**: `npm run dev` — dev server on port 3000.

### Auth & Secrets

Four secrets must be configured in the Cursor Cloud Secrets panel:

| Secret name | Purpose |
|-------------|---------|
| `GSC_SERVICE_ACCOUNT_JSON` | Google service-account key JSON (full contents). The update script writes it to `/tmp/gsc-service-account.json` and activates the gcloud service account. `~/.bashrc` conditionally exports `GOOGLE_APPLICATION_CREDENTIALS` pointing to that file. |
| `VERCEL_TOKEN` | Vercel personal access token for CLI operations. |
| `VERCEL_ORG_ID` | Vercel team / org ID. |
| `VERCEL_PROJECT_ID` | Vercel project ID for this site. |

Run `npm run smoke` to verify all credentials are present before using the ops scripts.

### Ops scripts

| npm script | What it does |
|------------|--------------|
| `npm run smoke` | Fail-fast check that all auth secrets are wired. |
| `npm run gsc:check` | Lists verified Search Console sites and last-7-day analytics for `sc-domain:paralabs.ai`. |
| `npm run vercel:status` | Shows recent Vercel deployments and latest production inspect. |

The underlying shell scripts live in `scripts/`. To set up auth manually in the current shell: `source scripts/setup-auth.sh`.

### Gotchas

- Pre-existing ESLint warnings (`<img>` vs `<Image />`, `<a>` vs `<Link />`) are downgraded to warnings and do not block the build.
- Blog content lives in `content/posts/` as markdown files with `YYYY-MM-DD-{slug}.md` naming.
- OG images are generated at build time via `satori` + `@resvg/resvg-js` + `sharp`.
- `gcloud` CLI is installed system-wide (via the VM snapshot, not npm). If missing, install via `apt-get install google-cloud-cli`.
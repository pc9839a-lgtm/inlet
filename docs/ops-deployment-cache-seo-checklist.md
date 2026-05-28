# Deployment, Cache, And SEO Checklist

Status: launch checklist.
Owner: Worker 5 QA/ops. Coordinate product or server behavior changes with the owning worker before editing code.

## Deployment Assumptions

- Static frontend is built with Vite.
- API server is Node-based unless moved to a platform worker later.
- Public landing pages may run on custom domains.
- Admin/editor routes must not be indexed.

## Build Artifact Policy

- Use a fresh output directory for release builds.
- Run the full local gate before pushing a release commit: `npm run qa:all`, `npm run runtime:qa`, `npm run css:qa`, `npm run bundle:qa`, `npm run deployment:qa`, `npm run integration:qa`, and strict `npm run artifact:qa -- --strict`.
- Deploy atomically where possible.
- Confirm `bundle-quality-check` ran against the same `--outDir` that will be deployed.
- Treat bundle warnings at 90%+ budget usage as launch notes; treat budget failures as release blockers.
- Do not rely on deleting locked local `dist` files as proof of production cleanup.
- Treat Windows `EPERM` during local cleanup as local environment risk unless production deploy also serves stale files.

## GitHub To Cloudflare Pages Release Order

1. Run local QA gates and confirm `live:qa` has no `fail` rows. Missing SMTP/OAuth/AI/conversion credentials may remain `skipped-live` only when explicitly accepted in the launch record.
2. Clean generated local artifacts with `npm run artifact:clean`, then confirm strict artifact QA reports no `dist-check-*`, `.tmp-*`, `inlet-deploy-artifact-*`, `preview.zip`, or `.tmp-browser-visual` artifacts.
3. Commit the QA/deploy/docs patch and push to GitHub `main` only after the local gates pass.
4. Deploy Cloudflare Pages from the pushed commit, not from uncommitted local files.
5. Record the Git commit SHA, Cloudflare Pages deployment id, production URL, and whether Pages Functions are active.
6. After deploy, run hosted checks against the production URL:
   - `INLET_PUBLIC_API_URL=https://<production-host> INLET_HOSTED_API_QA_REQUIRE=1 npm run api:hosted:qa`
   - `INLET_PUBLIC_API_URL=https://<production-host> INLET_HOSTED_ROUTE_QA_REQUIRE=1 npm run api:hosted:routes:qa`
   - `INLET_PUBLIC_API_URL=https://<production-host> npm run live:qa`
7. Run production browser QA with a real browser before launch sign-off:
   - PowerShell: `$env:INLET_PRODUCTION_BROWSER_QA_REQUIRE='1'; npm run browser:production:qa`
   - POSIX: `INLET_PRODUCTION_BROWSER_QA_REQUIRE=1 npm run browser:production:qa`
   - For a newly deployed Settings patch, set `INLET_PRODUCTION_QA_URL=https://<production-host>` or `INLET_PRODUCTION_QA_INCLUDE_NEXT_SETTINGS=1` so Settings duplicate policy and page duplication modal cases are included.
   - Then run `npm run artifact:clean` before strict artifact QA so screenshot/profile output cannot ship or block the artifact gate.
8. If deployment fails, do not retry with changed local files. Fix, rerun local gates, push a new commit, and deploy that commit.

## Cache Busting

- Built JS/CSS assets must include hashed filenames.
- `index.html` should not be cached longer than the deploy invalidation window.
- Public assets can be cached long-term only if filename hashed.
- After deploy, fetch `index.html` and confirm it references current asset names.

## SEO

- Public landing pages need title, description, canonical, and Open Graph image.
- Admin/editor pages should include noindex behavior at hosting/router level.
- `robots.txt` should allow public pages and disallow admin/editor paths.
- `sitemap.xml` should include only public, intended-to-index pages.

## Public Route Checks

- Public page loads without editor bundle assumptions.
- Custom domain route renders correct page.
- Map wrapper iframe loads from wrapper domain.
- Form submission writes to correct project context.
- Conversion scripts fire only on public page.

## Local Commands

- `npm run qa:all`
- `npm run build`
- `npm run bundle:qa`
- `npm run deployment:qa`
- `npm run integration:qa`
- `npm run artifact:clean`
- `npm run artifact:qa -- --strict`
- `npm run server:smoke:auth`
- `npm run server:smoke:pages`
- `npm run server:smoke:leads`
- `npm run conversion:qa`
- `npm run ops:qa`
- Optional release artifact rehearsal: `npm run build -- --outDir dist-check-deploy` then `INLET_BUNDLE_QA_DIR=dist-check-deploy npm run bundle:qa`.

## Implementation Tasks

- Worker 5: keep deployment gates, hosted API QA commands, and browser production QA commands in this document current.
- Worker 5: keep missing live credentials as `skipped-live` in QA output unless the operator configured credentials and the live check actually failed.
- Worker 1: coordinate any server/route-level noindex or hosting config implementation before changing server behavior.
- Worker 3: coordinate public route visual/template evidence before changing template/editor behavior.

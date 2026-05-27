# Deployment, Cache, And SEO Checklist

Status: launch checklist.
Owner: Worker 4 policy, Worker 1 deployment implementation, Worker 3 QA evidence.

## Deployment Assumptions

- Static frontend is built with Vite.
- API server is Node-based unless moved to a platform worker later.
- Public landing pages may run on custom domains.
- Admin/editor routes must not be indexed.

## Build Artifact Policy

- Use a fresh output directory for release builds.
- Deploy atomically where possible.
- Confirm `bundle-quality-check` ran against the same `--outDir` that will be deployed.
- Treat bundle warnings at 90%+ budget usage as launch notes; treat budget failures as release blockers.
- Do not rely on deleting locked local `dist` files as proof of production cleanup.
- Treat Windows `EPERM` during local cleanup as local environment risk unless production deploy also serves stale files.

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

- `npm run build -- --outDir dist-check-deploy`
- `INLET_BUNDLE_QA_DIR=dist-check-deploy npm run bundle:qa`
- `npm run server:smoke:auth`
- `npm run server:smoke:pages`
- `npm run server:smoke:leads`
- `npm run conversion:qa`
- `npm run ops:qa`

## Implementation Tasks

- Worker 1: add deployment check script for hashed assets and no stale references.
- Worker 1: add route-level noindex or hosting config guidance.
- Worker 3: add public route conversion check evidence.
- Worker 4: document production hosting assumptions when platform is selected.

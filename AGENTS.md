# AGENTS.md

## Required Korean Handoff

Before modifying or deploying Pagero, read:

- `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
- `docs/PAGERO_EDITOR_INTERACTION_PATCH_HANDOFF_KO.md` for editor, top navigation, sharing, form-focus, and timer follow-up work.

The production root source of truth is `functions/index.js`, not a file named
`functions/frozenHome.js` and not the local Vite home alone.

## Production Home Lock - Highest Priority

The current production root at `https://pagero.kr/` is the canonical Pagero
main screen. Internal editor, workspace, panel, auth, API, SEO, CI, and routing
work must not change its visible design, copy, structure, or behavior.

Locked production reference:

* Cloudflare Pages deployment: `https://8273caf2.inlet-8mr.pages.dev`
* Verified source commit: `f3121de`
* Root marker: `.pagero-exact-home`
* Frozen main JavaScript: `/c63-assets/index-pagero-main-fix-20260615.js`
* Frozen main stylesheet: `/c63-assets/index-B0Q5rFVf.css`
* Lifestyle bridge JavaScript: `/c63-life-bridge.js`
* Lifestyle bridge stylesheet: `/c63-life-bridge.css`
* Required heading: `모바일 페이지를빠르게 만드세요`

The locked main must keep all of these runtime signals:

* exactly one `.pagero-exact-home`
* exactly one `.c63-life-nav-link`
* exactly one `.c63-life-bridge`
* exactly four `.c63-life-post` links
* visible links to `https://life.pagero.kr/` and `https://awards.pagero.kr/`

Never modify, replace, reformat, restore, or remove production-home files as a
side effect of unrelated work. Protected scope includes:

* `index.html`
* `src/main.jsx`
* root/home routing in `src/App.jsx`
* public-home, landing, hero, and home screen components
* public-home CSS and frozen C63 assets
* `functions/index.js`
* root/home handling in `server/index.mjs`
* `public/c63-life-bridge.js` and `public/c63-life-bridge.css`

SEO-only changes may update `public/robots.txt`, `public/sitemap.xml`,
`public/ads.txt`, and crawler headers when they do not alter the rendered main.

## Main Integration Rules

Do not deploy a dirty worktree. Use a clean integration worktree and preserve
the verified production tree. Before pushing or deploying `main`:

1. fetch the current remote state
2. confirm the candidate contains the verified internal split and lifestyle bridge
3. confirm no protected-home diff was introduced
4. run the complete QA suite and deployment artifact checks
5. verify a preview at desktop, compact, and mobile widths
6. compare the preview DOM markers against the locked production reference
7. stop if any marker, visible content, or main asset differs

Never force-push `main`. Never use `reset`, `clean`, or file restore commands to
construct an integration. Merge history only when the resulting tree remains
the already verified candidate tree.

Do not deploy `1bd91160-8741-490f-8d85-402179a12bbc`; it removes the required
lifestyle bridge. Production deployment requires explicit user approval.

## Product Context

Pagero is a Korean mobile-first landing-page and lead-form builder. The editor
is a focused SaaS workspace for building, previewing, configuring, and
publishing lead-generation pages.

Primary flow:

`add block -> check mobile preview -> edit selected block -> save/publish`

Desktop editor structure:

* top bar: page name, save status, preview, publish
* block list: order, visibility, selection, compact actions
* live mobile preview
* selected-block settings panel: content, behavior, style

Mobile does not provide the full editor. Mobile surfaces prioritize submissions
and statistics.

## Editor UI Rules

* Keep the block list separate from detailed widget settings.
* A block row contains drag handle, order, icon, name, visibility, and actions.
* Keep global page options separate from block settings.
* Use short Korean labels and minimal helper text.
* Avoid nested cards, excessive borders, and heavy outlined pill buttons.
* Use one consistent system for buttons, toggles, inputs, radii, and borders.
* Hide secondary actions in compact menus without removing required actions.
* Do not change working API, auth, database, routing, or public-home behavior
  during editor-only work.

Patch editor work in this order:

1. block list
2. selected-block settings panel
3. page/global settings separation
4. shared controls and styles
5. panel cleanup
6. one widget editor at a time

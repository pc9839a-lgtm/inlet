# Worker 4: Settings, Managers, Ownership, Page Duplication, Admin

Updated: 2026-05-28

## Goal

Finish Settings and operator UX after deployment `6e4178c`: manager permissions, ownership transfer, page duplication, duplicate policy UI wiring, and internal admin tools.

Do not implement final payment checkout.

## Current Baseline

Already deployed:

- Settings manager permission baseline exists.
- Manager invite accept route exists.
- Ownership transfer API and internal admin queue baseline exist.
- Page duplication URL modal baseline exists.
- Duplicate/spam settings section baseline exists.
- Production browser QA covers manager settings, duplicate settings, page duplication modal, and internal admin ownership queue.

Do not redo those from scratch. Make them complete and usable.

## Primary Files

- `src/panels/SettingsPanel.jsx`
- `src/panels/SettingsPanel.css`
- `src/App.jsx` only for route/tab gating or admin/page duplication entry
- `src/lib/pageDuplication.js`
- `src/lib/managerInvites.js`
- `src/lib/ownershipTransfer.js`
- `src/lib/permissions*`
- `scripts/production-browser-quality-check.mjs` only for visual QA coverage

Server changes should be minimal unless Worker 2 or Worker 1 has already provided the API contract.

## Patch A: Manager Permission UX

Rules:

- Manager permission settings belong in project Settings for every client/admin project.
- Do not move normal client manager settings into internal admin.
- Internal admin is for operator-only control, not normal project staff management.
- Use user-facing Korean labels: 보기, 편집.
- Do not show a huge read/write grid by default.
- First show manager summary and menu-level permission.
- Detailed permission editing may open after selecting a manager/menu.
- Remove unnecessary active toggle if remove/disable covers the need.
- Manager invite should create and copy the invite link in one action after valid name/email.
- Invite acceptance must require login/signup and matching email.
- If authenticated email differs from invite email, show: `초대받은 이메일을 확인해주세요.`

QA:

- compact desktop and normal desktop browser QA;
- manager cannot access tabs without permission;
- manager cannot write where only 보기 is granted;
- removed manager loses access.

## Patch B: Ownership Transfer UX

Rules:

- Section title is exactly `소유권이전`.
- Keep section collapsed by default.
- Transfer target must be selected from existing managers only.
- Transfer request must go to internal admin approval before completion.
- User-facing states: requested, waiting billing clearance, approved, rejected, completed, canceled.
- If a paid subscription exists later, transfer waits until current billing period expires or subscription is canceled.
- Do not implement card/payment handoff now.

Admin:

- internal admin queue should show transfer requester, target manager, project, current billing placeholder, status, timestamps.
- admin can approve/reject/mark billing wait only through protected operator route.
- every dangerous action needs audit log.

QA:

- manager cannot self-transfer ownership;
- non-owner cannot request transfer;
- approval path updates status;
- billing-blocked path stays pending.

## Patch C: Page Duplication UX

Rules:

- Template duplication is not needed.
- Page duplication is paid-only later.
- Clicking page duplication must first open URL setup.
- Do not immediately copy a page.

URL setup:

- default provided domain mode: slug input, slug validation, duplicate check;
- custom domain mode: domain input, pending DNS status;
- saved fields should be domain-agnostic: `domainType`, `slug`, `customDomain`, `domainStatus`;
- do not hard-code current Cloudflare Pages domain into page records;
- future base-domain change should not require rewriting all page records.

Copy behavior:

- copy page settings, blocks, style, form structure, CTA, effects, SEO basics;
- do not copy leads, stats, delivery logs, manager permissions, ownership transfer history, billing/subscription state, or audit history.

Paid state:

- before billing implementation, show locked paid behavior clearly;
- do not pretend checkout exists;
- page duplication request can validate URL flow but must not unlock paid copy without plan state.

QA:

- locked plan shows locked state;
- URL modal opens first;
- default slug validation works;
- custom domain pending state works;
- copied data exclusions are tested in unit/runtime QA.

## Patch D: Duplicate/Spam Settings UI Wiring

Worker 2 owns server policy. Worker 4 owns the Settings UI.

UI must expose:

- IP duplicate rejection on/off;
- cookie/client duplicate rejection on/off;
- form-field duplicate count;
- duplicate period;
- phone/email mark vs block mode;
- blocked history panel or entry point.

Rules:

- Keep section compact.
- Do not show a massive advanced grid by default.
- Empty blocked history means no blocked rows.
- Unloaded/unavailable history must be a different state.
- Save should persist to the server model when Worker 2 API exists.
- Until API exists, label it as local draft or disabled; do not make it look production-enforced.

QA:

- open section;
- change options;
- save;
- reload/fetch and verify values;
- blocked-history empty/unavailable states.

## Patch E: Internal Admin Operator Tools

Internal admin should remain route-only, such as `/admin`.

Needed tools:

- user search by email, phone, status;
- project search by project id, slug, owner/client email;
- ownership transfer approval queue;
- account suspend/restore;
- project pause/archive;
- abuse/blocked-history review;
- audit log search/filter;
- system health summary.

Rules:

- Public workspace navigation must not show internal admin controls.
- Operator actions require protected operator auth.
- Every dangerous action needs audit log.

## Do Not Touch

- Template content.
- Lead duplicate server implementation.
- D1 backfill.
- SMTP/OAuth/conversion live implementation.
- Toss/payment checkout.

## Final Report

Report:

- changed files;
- manager permission behavior;
- ownership transfer states touched;
- page duplication URL flow;
- duplicate settings UI/API wiring state;
- internal admin tools changed;
- QA commands and results;
- remaining server/API or billing blockers.

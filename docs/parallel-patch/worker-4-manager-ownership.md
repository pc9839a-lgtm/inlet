# Worker 4: Manager Permissions, Ownership Transfer, Page Duplication UX

Updated: 2026-05-28

## Goal

Finish Settings manager permission UX, ownership transfer UX, and paid-gated page duplication flow without implementing final payment checkout.

## Work Mode

- Do not send routine progress reports.
- Inspect the Settings/manager/ownership/page-duplication area broadly, not only the exact bullet list.
- Patch obvious permission UX, invite flow, ownership transfer, page duplication, URL setup, locked paid-state, and visual overflow risks found inside this worker area.
- Do not stop after listing a manager/ownership/page-duplication risk if it can be fixed safely within owned files.
- Ask only for real payment behavior, destructive ownership changes, unclear product decisions, or edits outside this worker boundary.

## Owns

- Settings manager permission UI.
- Settings duplicate/spam prevention UI if Worker 2 exposes or documents the API/model.
- Manager invite UX.
- Ownership transfer request UX.
- Internal-admin ownership approval UI only where required.
- Page duplication UX and URL setup modal.
- Feature-gate placeholder for paid-only page duplication.

## Primary Files

- `src/panels/SettingsPanel.jsx`
- `src/App.jsx` only for route/tab gating or page duplication modal entry.
- `src/lib/permissions*`
- `src/lib/page*`
- `src/styles/panels.css`
- `scripts/*permission*`
- `scripts/*ownership*`
- `scripts/browser-visual-quality-check.mjs` only if adding focused visual QA.

## Allowed High-Conflict Files

- `src/panels/SettingsPanel.jsx`
- `src/App.jsx`
- `src/styles/panels.css`

Do not change server auth internals unless the API contract already exists and only a small route call is needed.

## Required Product Rules

Manager permissions:

- Manager permission settings belong in normal Settings for every client/admin project.
- Do not move client manager permission controls into internal admin.
- Labels must be user-facing Korean: `보기`, `편집`.
- Menu permission itself should be compact. Do not show a huge read/write toggle grid by default.
- Detailed permissions can expand after selecting a menu/manager.
- Manager invite should create and copy the invite link in one action after valid name/email input.
- Remove unnecessary active toggle if deletion/disable covers the actual need.
- Invited manager must login/signup and only load the invited project when authenticated email matches invite email.
- If email differs, show `초대받은 이메일을 확인해주세요.`

Ownership transfer:

- In Settings, show collapsed section named exactly `소유권이전`.
- Transfer target must be selected from existing managers only.
- Request must go to internal admin approval before completion.
- If paid subscription exists later, transfer waits until billing period expires or subscription is canceled.
- Real card/payment handoff is deferred to final billing.

Page duplication:

- Template duplication is not needed.
- Paid feature is page duplication only.
- `페이지 복제` must not immediately copy the page.
- First open `URL 설정` modal.
- URL setup must support:
  - `기본 제공 도메인`: slug input and duplicate check.
  - `개인 도메인`: domain input saved as pending DNS state.
- Store URL data as fields like `domainType`, `slug`, `customDomain`, `domainStatus`.
- Do not hard-code current Cloudflare Pages domain in saved page data.
- Future base-domain change must not require rewriting page records.
- Copy page settings, blocks, style, form structure, CTA, effects, and SEO basics.
- Do not copy leads, stats, delivery logs, manager permissions, ownership-transfer history, payment/subscription state, or audit history.
- Until billing exists, use plan/feature placeholder to show locked paid behavior.

Duplicate/spam settings UI:

- If Worker 2 provides the data/API contract, add the owner-facing settings section for collection duplicate settings.
- Section title should be `수집 데이터 중복 설정`.
- The UI must let users choose options instead of forcing one hidden server policy.
- Required controls:
  - `IP중복 수집 거절` on/off.
  - `쿠키를 이용한 중복 수집 거절` on/off.
  - `폼 데이터 중복 제한 개수` select.
  - `폼 데이터 중복 제한 기간` select.
- Defaults should match Worker 2 policy: cookie duplicate rejection on, IP duplicate rejection off or short-window only, phone/email duplicate mark-only unless stricter mode is selected.
- Add a blocked history entry point or panel so users can review blocked/limited submissions.
- Blocked history should show date, page/form, reason, and safe identifiers such as masked contact or hashed IP/client id. Do not expose raw IP if Worker 2 stores only hashes.
- Keep the UI compact and consistent with Settings. Do not show a huge advanced grid by default.
- If the UI currently saves only to page JSON, treat it as partial until it is wired to Worker 2's server persistence/read path.
- The UI must clearly show when blocked history is empty versus not yet loaded from the server.
- Add focused QA or browser QA for opening the duplicate settings section, changing the options, saving, and seeing the saved values remain after reload/server fetch.

Current local recheck notes:

- A Settings `수집 데이터 중복 설정` section, page duplication `URL 설정` modal, and paid placeholder may exist locally.
- Do not treat Worker 4 as complete until page duplication has QA for locked paid state, default-domain slug validation, custom-domain pending state, and copied-data exclusions.
- Do not treat duplicate/spam settings UI as complete until server policy consumes the saved settings and blocked history comes from a server read path.

## Do Not Touch

- Template content.
- Lead duplicate/rate-limit implementation.
- D1 backfill.
- SMTP/OAuth/live conversion implementation.
- Toss/payment checkout.

## QA

Run at minimum:

- `npm run auth:qa` if touching permission/session gates.
- `npm run rendering:qa`
- `npm run runtime:qa`
- Add focused browser/runtime QA for page duplication URL modal and duplicate/spam settings persistence.
- `npm run browser:production:qa` after deploy if UI changes are visible.
- `npm run build`

Report:

- Changed files.
- Manager invite behavior.
- Ownership transfer states touched.
- Page duplication modal flow and URL fields.
- Extra manager/ownership/page duplication risks found and patched.
- Remaining server API gaps, if any.

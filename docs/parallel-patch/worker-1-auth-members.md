# Worker 1: Account, Auth, Sessions, Members

Updated: 2026-05-28

## Goal

Make account, login, email verification, session, profile, and member data production-ready without touching template/content polish or inbox/stat UI.

## Work Mode

- Do not send routine progress reports.
- Inspect the auth/account/member area broadly, not only the exact bullet list.
- Patch obvious security, validation, session, duplicate-account, and QA risks found inside this worker area.
- Do not stop after listing an auth/member risk if it can be fixed safely within owned files.
- Ask only for destructive data actions, live email credentials, unclear product decisions, or edits outside this worker boundary.

## Owns

- Account register/login/session/logout/password flows.
- Email verification contract and real transactional email boundary.
- Duplicate email and duplicate phone enforcement for accounts.
- Account profile/settings data model.
- Member data persistence that supports master/client/manager accounts.
- D1-backed account/member/session persistence where practical.

## Primary Files

- `server/index.mjs`
- `server/storage/d1Adapter.mjs`
- `server/storage/runtimeAdapter.mjs`
- `migrations/0001_inlet_core.sql`
- `src/auth/**`
- `src/lib/auth*`
- `scripts/*auth*`
- `scripts/server-smoke-auth*`
- `docs/**` only for auth/member notes

## Allowed High-Conflict Files

- `server/index.mjs`
- `migrations/0001_inlet_core.sql`

Do not edit `src/panels/SettingsPanel.jsx` except for small account-profile wiring that cannot live elsewhere.

## Required Product Rules

- Signup requires verified email.
- Password must be at least 6 characters and include English letters plus numbers.
- Password reset must be: email verification completed -> set new password -> return to login.
- Duplicate email and duplicate phone must be server-side checks, not only frontend checks.
- Expired sessions must return the user to login with clear user-facing Korean copy.
- In production/strict auth mode, server must not trust forged local identity headers.
- Hosted auth remains blocked until a real provider exists; signed session is current production source of truth.

## Do Not Touch

- Template content.
- Preview/editor CSS.
- Inbox row layout.
- Stats charts.
- Page duplication modal UI, except auth gating hooks if required.
- Payment provider implementation.

## Next Assignment After Current Passing Patch

If the current auth/member patch is already passing QA, continue with these items instead of waiting for another handoff.

1. Account settings UX
   - Add or polish the real user account area for name, email, phone, password change, logout, and session status.
   - Keep project manager permissions inside project Settings, but keep personal account/profile data separate from project ownership controls.
   - When email or phone changes later require verification, make the current state explicit: pending, verified, rejected, or unavailable.

2. Transactional email boundary
   - Keep mock email verification working offline.
   - Add provider boundary points for verification email, manager invite email, password reset verification, ownership transfer approval/rejection, and later payment failure email.
   - Missing provider credentials must show skipped-live or unavailable state, not a broken signup path.
   - Do not hard-code a provider. Keep SMTP/provider implementation swappable.

3. D1-backed account/session/member hardening
   - Move remaining account, session, member, invite, and access reads toward D1 when D1 is active.
   - Keep JSONL/local fallback for development and import/backfill only.
   - Do not remove `access.json` fallback until smoke proves D1 reads cover owner, client admin, accepted manager, removed manager, and transferred client cases.
   - Add or extend adapter QA for every new D1 account/member read/write path.

4. Account state and safety
   - Add account states needed for launch operations: active, pending_verification, suspended, deleted_pending_retention.
   - Login/session refresh must reject suspended/deleted accounts with clear Korean copy.
   - Duplicate email and duplicate phone checks must include inactive/suspended/deleted records unless the product explicitly allows re-use after retention.
   - Add audit rows for signup, verification, login failure category, password change, profile change, invite accepted, member removed, and suspension state changes.

5. Session expiry and browser behavior
   - Expired session should clear local auth state and route to login without leaving the app in a broken protected screen.
   - Manager invite accept should keep the short mismatch copy: `초대받은 이메일을 확인해주세요.`
   - If account/profile UI changes are visible, add or update browser QA state for login, profile, logout, expired session, and invite email mismatch.

## QA

Run at minimum:

- `npm run auth:qa`
- `npm run server:smoke:auth`
- `npm run d1:schema:qa`
- `npm run d1:adapter:qa`
- `npm run api:functions:qa` if hosted route mapping or Pages Functions behavior changes
- `npm run runtime:qa`
- `npm run build`

Report:

- Changed files.
- New/changed API endpoints.
- Extra auth/member risks found and patched.
- Whether signup, login, session refresh, logout, verified password reset, duplicate email, and duplicate phone are covered.
- Remaining live dependency, especially transactional email provider credentials.

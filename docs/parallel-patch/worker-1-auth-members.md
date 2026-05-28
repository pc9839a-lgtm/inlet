# Worker 1: Account, Auth, Sessions, Members

Updated: 2026-05-28

## Goal

Make account, login, email verification, session, profile, and member data production-ready without touching template/content polish or inbox/stat UI.

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

## QA

Run at minimum:

- `npm run auth:qa`
- `npm run server:smoke:auth`
- `npm run d1:schema:qa`
- `npm run d1:adapter:qa`
- `npm run runtime:qa`
- `npm run build`

Report:

- Changed files.
- New/changed API endpoints.
- Whether signup, login, session refresh, logout, verified password reset, duplicate email, and duplicate phone are covered.
- Remaining live dependency, especially transactional email provider credentials.

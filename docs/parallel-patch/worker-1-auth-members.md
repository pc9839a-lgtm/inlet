# Worker 1: Account, Auth, Sessions, Members

Updated: 2026-05-28

## Goal

Finish production account, session, member, and transactional-email foundations after deployment `6e4178c`.

This worker must not touch template quality, inbox layout, stats UI, page duplication UX, or payment checkout.

## Current Baseline

Already deployed:

- `/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`.
- Offline email verification issue/confirm contract.
- Signup requires verified email.
- Password rule exists: at least 6 characters and English letters plus numbers.
- Duplicate email and duplicate phone must be server-side checks.
- Manager invite accept route exists.
- Signed session strict/production mode exists.
- Hosted route QA passed after deployment.

Do not redo those from scratch. Build on them.

## Primary Files

- `server/index.mjs`
- `server/storage/d1Adapter.mjs`
- `server/storage/runtimeAdapter.mjs`
- `src/lib/authAccounts.js`
- `src/auth/**`
- `src/screens/InviteAcceptScreen.jsx`
- `scripts/auth-context-check.mjs`
- `scripts/server-smoke-auth.mjs`
- `migrations/*.sql` only for account/member/session schema changes

Avoid `src/panels/SettingsPanel.jsx` unless adding a small account-profile entry that cannot live elsewhere.

## Patch A: Account Settings UX And API

Add the account/profile surface that a real paying user expects.

Required fields:

- name;
- email;
- phone;
- password change;
- current session status;
- logout.

Rules:

- Account profile is personal account data. Do not mix it with project ownership or manager permission controls.
- Email and phone edits should expose verification state even if full re-verification is not implemented yet.
- Use clear states: verified, pending verification, failed, unavailable.
- Password change must require verified email flow or current-password confirmation. If only verified-email reset exists now, do not fake current-password confirmation.
- Logout should clear local auth state and return to login without a broken protected screen.

QA:

- `npm run auth:qa`
- `npm run server:smoke:auth`
- `npm run runtime:qa`
- add browser QA if visible login/profile/logout UX changes.

## Patch B: Account State Model

Add operational account states.

Required states:

- `active`
- `pending_verification`
- `suspended`
- `deleted_pending_retention`

Behavior:

- Login rejects suspended accounts.
- Session refresh rejects suspended/deleted-pending-retention accounts.
- Deleted-pending-retention does not hard-delete operational records.
- Error copy must be Korean and user-facing.
- Duplicate email/phone checks must include suspended and deleted-pending-retention accounts unless a later retention policy explicitly allows reuse.

Audit rows:

- signup;
- verification confirmed;
- login failed with category;
- password changed;
- profile changed;
- account suspended/restored;
- account marked deleted-pending-retention.

QA:

- extend `auth:qa`;
- extend `server:smoke:auth`;
- extend `d1:adapter:qa` if D1 account rows change.

## Patch C: Transactional Email Boundary

Keep the offline mock flow working, but add a real provider boundary.

Decision baseline as of 2026-05-28:

- Preferred first live provider: AWS SES.
- Reason: lowest long-term unit cost, stable production scale, no monthly minimum for basic sending.
- Free tier exists but is limited: AWS SES currently provides up to 3,000 message charges per month for the first 12 months after SES usage starts. Do not design the product around the free tier.
- Expected post-free cost: roughly USD 0.10 per 1,000 outbound emails, excluding data/add-on charges.
- Brevo/Resend may remain secondary adapters, but do not block launch on them if SES is chosen.
- Cloudflare Pages Functions must use an HTTP/API signing flow, not raw SMTP sockets. Do not rely on `node:net` or `node:tls` SMTP in production runtime.
- SES account may start in sandbox. Production sending requires SES production access approval and verified sender domain/email.

Email events:

- signup verification;
- manager invite;
- password reset verification;
- ownership transfer approval;
- ownership transfer rejection;
- later payment failure notice.

Rules:

- Do not hard-code one provider.
- Provider implementation must be swappable.
- Do not expose raw verification tokens to the browser in production email mode.
- User-facing send failure copy must stay generic:
  - `인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.`
- Do not show quota, provider, DNS, sandbox, API key, or internal reason to the user.
- Server/operator logs may classify internal causes:
  - `EMAIL_SEND_NOT_CONFIGURED`
  - `EMAIL_SEND_QUOTA_EXCEEDED`
  - `EMAIL_SEND_PROVIDER_ERROR`
  - `EMAIL_SEND_TIMEOUT`
  - `EMAIL_SEND_SANDBOX_REJECTED`
  - `EMAIL_DOMAIN_NOT_VERIFIED`
- Missing credentials must report `skipped-live` or unavailable, not fail normal offline QA.
- Do not log secrets.
- Do not expose raw tokens in production logs.
- Token expiry and one-time-use behavior must be smoke-tested.

Required SES configuration:

- AWS region, for example `ap-northeast-2` or another selected SES-supported region.
- `AWS_SES_REGION`
- `AWS_SES_ACCESS_KEY_ID`
- `AWS_SES_SECRET_ACCESS_KEY`
- `INLET_AUTH_EMAIL_FROM`, for example `WAYZI <no-reply@your-domain>`
- `INLET_AUTH_EMAIL_MODE=api`
- `INLET_EMAIL_PROVIDER=ses`

Required DNS/domain setup:

- Verify sender domain in SES.
- Add DKIM records.
- Add SPF record.
- Add DMARC record.
- Use a service-owned sender such as `no-reply@your-domain`.
- Do not send production auth mail from a personal mailbox.

Rate-limit rules:

- Same email verification request: at most once per minute.
- Same email daily resend cap: small fixed count, for example 5.
- Same IP short-window cap: required to reduce abuse.
- Already verified account should not receive unlimited signup verification mail.
- Mail provider failure must not bypass email verification.

Expected output:

- provider interface or small service module;
- server route integration;
- mock/offline implementation;
- AWS SES HTTP/API implementation for Cloudflare Pages Functions;
- live readiness status in existing live/ops QA if touched.

QA:

- `npm run server:smoke:auth`
- `npm run integration:mock:qa` if mock integration contracts change
- `npm run live:qa` should show skipped-live without credentials.
- hosted QA with real credentials should prove email issue route returns provider delivery status without exposing token.

## Patch D: D1 Account/Member Persistence Hardening

Move remaining account/member/session/invite reads toward D1.

Rules:

- D1 is production source where available.
- JSONL/access-file fallback remains for local dev/import only.
- Do not remove fallback until smoke proves all cases are covered.
- Covered cases must include owner, client admin, accepted manager, removed manager, transferred client, suspended account, and expired session.
- If adding migrations, update schema QA and deployment docs.

QA:

- `npm run d1:schema:qa`
- `npm run d1:adapter:qa`
- `npm run server:smoke:auth`
- `npm run api:hosted:routes:qa` when hosted env is available.

## Do Not Touch

- Template content.
- Preview/editor CSS.
- Inbox compact row design.
- Stats chart UI.
- Page duplication modal UX.
- Payment provider implementation.

## Final Report

Report:

- changed files;
- new/changed auth endpoints;
- account states implemented;
- email provider boundary status;
- D1 account/member persistence changes;
- QA commands and results;
- remaining live credential needs.

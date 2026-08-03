# Conversion Tracking Production Verification

Updated: 2026-08-03

This runbook verifies the deployed Pagero conversion configuration and the browser dispatch contract without creating a lead, submitting a reservation, or sending a request to an advertising platform.

The verification is intentionally split into two levels:

1. This automated workflow verifies the deployed public fixture configuration, approved script destinations, privacy-safe event payloads, direct GA4 dispatch, Meta consultation/reservation semantics, and duplicate suppression.
2. External platform receipt must still be confirmed manually in GTM Preview, GA4 DebugView, Meta Test Events, Google Ads diagnostics, Naver, or Kakao with account access.

## Product Corrections Covered

The conversion dispatch now:

- sends a direct GA4 event when GA4 is configured
- uses `lead_submit` for consultation submission
- uses `reservation_submit` for reservation submission
- maps Meta consultation to `Lead`
- maps Meta reservation to `Schedule`
- suppresses a repeated conversion call for the same page, event, and lead
- omits the raw lead ID, name, phone, email, and message from third-party event payloads
- returns safely when a browser window is unavailable

Google Ads continues to receive its configured `conversion` event and `send_to` label. GTM continues to receive the Pagero event through `dataLayer`.

## Security Boundary

The workflow fetches only the public Pagero page API. Before the request, the safe entrypoint requires:

- an exact HTTPS origin
- `https://pagero.kr` as the only default origin
- preview origins listed exactly in `PAGERO_CONVERSION_ALLOWED_ORIGINS`
- no username, password, path, query, or fragment in the configured origin
- a dedicated page slug beginning with `qa-conversion-`
- `redirect: error`
- a bounded request timeout

The verifier creates fake browser objects in Node. Tracker script elements are recorded but never loaded. Therefore no advertising-platform request, pixel event, Google Analytics event, or Google Ads conversion is transmitted by this workflow.

Evidence contains only channel names, approved script hostnames, event names, and boolean results. It does not contain tracking IDs, page/project IDs, lead IDs, contact details, cookies, sessions, tokens, or customer page contents.

## Required Public Fixture

Prepare one disposable public page with all of these properties:

1. The slug starts with `qa-conversion-`.
2. The title starts with `QA`.
3. Conversion tracking is enabled.
4. At least one test tracking channel is configured.
5. When GTM is configured, `dataLayer` conversion events are enabled.
6. The page contains no customer copy, customer forms, customer tracking IDs, or customer data.
7. Use dedicated QA containers, properties, pixels, and conversion labels only.

The automated workflow does not modify this page.

## Workflow

Workflow: `Conversion Tracking Production Verify`

It is manual-only and uses the GitHub `production` environment.

Inputs:

- `base_url`: exact approved Pagero HTTPS origin
- `page_slug`: dedicated public `qa-conversion-` page
- `require_live`: when true, a missing or invalid fixture fails rather than returning `skipped-live`

Repository variable:

- `PAGERO_CONVERSION_ALLOWED_ORIGINS`: exact comma-separated preview origins; leave empty for production-only verification

No credential Secret is required because the fixture is public and the workflow performs no writes.

## Automated Checks

The workflow verifies:

- the public API returns the requested fixture page
- the returned slug and title identify a QA-only page
- conversion tracking is enabled
- at least one configured channel exists
- tracker script destinations are limited to approved HTTPS hosts
- consultation produces `lead_submit`
- reservation produces `reservation_submit`
- direct GA4 events are emitted when GA4 is configured
- Meta uses `Lead` for consultation and `Schedule` for reservation
- Google Ads uses its `conversion` event when configured
- repeated dispatch for the same lead is suppressed
- raw lead IDs and contact values are absent from captured event calls
- no external advertising request is performed
- no lead or reservation write is performed

## Status Meanings

- `verified-live`: the deployed public fixture and local dispatch contract passed all automated checks
- `skipped-live`: the fixture was unavailable and `require_live=false`
- `failed-live`: origin validation, fixture validation, script target, event semantics, privacy, or duplicate suppression failed

A `verified-live` result from this workflow does not prove that an external advertising account received an event.

## External Platform Receipt

After the automated workflow succeeds, an operator with access to the dedicated QA accounts must separately verify:

- GTM Preview receives `lead_submit` and `reservation_submit`
- GA4 DebugView receives both custom events
- Meta Test Events receives `Lead` and `Schedule`
- Google Ads diagnostics receives the configured conversion label
- Naver and Kakao diagnostics receive the intended event when enabled

Use a QA-only page and QA-only identifiers. Do not submit real names, phone numbers, email addresses, or customer inquiries.

External platform receipt is manual because those platforms require account access and can retain event data. Record only screenshots or event timestamps that do not expose customer data or credentials.

## Evidence To Retain

- workflow run URL and run number
- tested GitHub commit SHA
- deployed commit or deployment identifier
- exact approved Pagero origin
- dedicated fixture slug
- `conversion-production-evidence-<run-id>` artifact
- configured channel names
- `lead_submit` and `reservation_submit` result
- duplicate suppression result
- separate external account diagnostic evidence, when performed

## Local Commands

```bash
npm run conversion:qa
npm run conversion:production:contract:qa
npm run qa:all
npm run build
```

## Non-Actions

This workflow does not:

- submit a Pagero consultation form
- create or delete a lead
- submit a reservation
- load a real third-party tracker script
- transmit an advertising event
- change a tracking configuration
- deploy or merge code

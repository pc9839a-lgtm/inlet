# Worker 3: Templates, Public Landing, Editor Preview Polish

Updated: 2026-05-28

## Goal

Make the three active templates feel like real public pages while preserving editable block structure and improving editor/preview polish.

## Active Templates

Only these three templates are active:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Do not add more templates.

## Owns

- `src/templates/**`
- `src/preview/**`
- `src/editor/blockEditors/**`
- `src/editor/RichField.jsx` only if editor text behavior requires it.
- `src/styles/preview-*.css`
- `src/styles/effects.css`
- Template/rendering/browser QA coverage related to public pages.

## Allowed High-Conflict Files

- Avoid `src/App.jsx`.
- Avoid `src/panels/SettingsPanel.jsx`.
- Avoid `server/index.mjs`.
- Touch `package.json` only if adding a required QA script, and coordinate with Worker 5.

## Required Product Rules

Template content:

- Use exactly three templates: personal rehabilitation, mobile wedding invitation, real estate presale.
- Do not write instructional copy, editor guidance, feature explanations, or sample-section descriptions inside templates.
- Do not use phrases like "edit this", "enter content here", "this section shows", or usage-guide style text.
- Public template copy must read like a real page that could be shown to an end customer.
- Every visible section must remain editable through existing blocks.
- No hard-coded non-editable HTML landing pages.
- No template duplication feature. Templates are start presets only.

Template direction:

- Personal rehabilitation: consultation DB page, trust, eligibility, debt situation, free consultation, FAQ, compliant wording.
- Mobile wedding invitation: date, names, gallery, venue/map, attendance RSVP, celebration message, subtle premium effects.
- Real estate presale: complex/project name, location, premium points, type/visit consultation, map, visit reservation, credibility.

Visual/effect rules:

- Premium effects must be subtle, randomized, and layered over imagery without blocking readability.
- Snow/petals/sparkle must not look like static dots or oversized cheap decoration.
- Preview scrolling must not freeze.
- Text color/font/tone/rich toolbar behavior already has browser QA; do not regress it.
- Cards block remains `1/2` columns only. Do not bring back 3 columns.

## Do Not Touch

- Account/auth/member server logic.
- Lead duplicate policy.
- Inbox/stat data flow.
- Manager permission/ownership transfer UX.
- Billing implementation.

## QA

Run at minimum:

- `npm run templates:qa`
- `npm run rendering:qa`
- `npm run css:qa`
- `npm run runtime:qa`
- `npm run build`
- `npm run browser:production:qa` after deployment or when production QA is requested

Report:

- Changed files.
- Which template was changed.
- Confirmation that every visible section remains editable.
- Confirmation that no instructional/sample copy remains.
- Screenshots or browser QA case names if visual QA was run.

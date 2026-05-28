# Worker 3: Templates, Public Landing, Editor Preview Polish

Updated: 2026-05-28

## Goal

Make the three active templates feel like real finished pages while preserving editable block structure.

The active templates are:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Only these three templates are active.

Do not add more templates. Do not add template duplication. Page duplication belongs to Worker 4.

## Current Baseline

Already deployed:

- Template count is 3.
- Template structural QA passes.
- Production browser QA covers the three first-viewport cases.
- Style color/font/rich text toolbar production QA passes.
- Cards block is intentionally limited to 1 or 2 columns.

Do not rebuild the template system from scratch. Improve depth and polish.

## Primary Files

- `src/templates/**`
- `src/preview/**`
- `src/editor/blockEditors/**`
- `src/editor/RichField.jsx` only for editor text behavior
- `src/styles/preview-*.css`
- `src/styles/effects.css`
- `scripts/template-quality-check.mjs`
- `scripts/rendering-quality-check.mjs`

Avoid `src/App.jsx`, `src/panels/SettingsPanel.jsx`, and `server/index.mjs`.

## Template Rules

Public template copy must never look like builder instructions.

Do not write instructional copy.

Forbidden public copy patterns:

- edit this;
- enter content here;
- sample section;
- this section shows;
- usage guide;
- feature explanation;
- placeholder copy;
- any text that explains the editor rather than selling/informing the end customer.

All visible sections must remain editable through existing blocks.

No hard-coded non-editable landing HTML.

## Patch A: Personal Rehabilitation Consultation

Make it a real consultation DB page.

Expected flow:

- topnav;
- hero with direct but compliant value proposition;
- trust/credibility;
- eligibility or situation check;
- debt problem empathy without illegal guarantees;
- consultation benefit;
- form;
- FAQ;
- bottom CTA.

Compliance:

- no guaranteed approval;
- no guaranteed debt reduction;
- no guaranteed legal result;
- avoid overpromising;
- use careful, consultative wording.

Form:

- collect useful consultation fields;
- avoid fake demo labels;
- keep all fields editable.

## Patch B: Mobile Wedding Invitation

Make it feel like a real premium mobile invitation.

Expected flow:

- couple names;
- date/time;
- greeting/message;
- gallery;
- venue/map;
- RSVP;
- account/contact section if present;
- bottom CTA or RSVP shortcut.

Effects:

- petals/snow/sparkle must be subtle and randomized;
- particles should not look like static square dots;
- effects should layer over imagery where appropriate;
- text must remain readable;
- preview scroll must not freeze.

## Patch C: Real Estate Presale

Make it feel like a real presale/visit reservation landing page.

Expected flow:

- project name;
- location;
- premium points;
- unit/type or benefit section;
- gallery/image emphasis;
- visit reservation;
- map;
- FAQ;
- bottom CTA.

Rules:

- Do not rely only on vague luxury words.
- Avoid fake sample names that look like QA fixtures.
- Map fallback must be clear when exact address is missing.
- Keep reservation form useful and editable.

## Patch D: Editor And Preview Polish

Continue fixing:

- text color not reflecting live;
- background/effect controls not reflecting live;
- font/tone mismatch;
- underline/bold/rich text edge cases;
- topnav chip overflow;
- CTA chip sizing;
- map/gallery/form overlap;
- mobile first viewport fit;
- preview scroll freeze after effects.

Do not reintroduce 3-column card mode.

QA:

- `npm run templates:qa`
- `npm run rendering:qa`
- `npm run css:qa`
- `npm run runtime:qa`
- `npm run build`
- production browser QA if visible behavior changes.

## Do Not Touch

- Account/auth/member server logic.
- Lead duplicate policy.
- Inbox/stat data flow.
- Manager permission/ownership transfer UX.
- Billing implementation.

## Final Report

Report:

- changed files;
- which template changed;
- visible section editability confirmation;
- removed instructional/sample copy;
- effect/preview fixes;
- QA commands and results;
- screenshots or browser QA case names if visual QA ran.

# Worker 3: Templates, Public Landing, Editor Preview Polish

Updated: 2026-05-28

## Goal

Make the three active templates feel like real public pages while preserving editable block structure and improving editor/preview polish.

## Work Mode

- Do not send routine progress reports.
- Inspect the template/editor/preview area broadly, not only the exact bullet list.
- Patch obvious template copy, editability, preview, visual effect, style-control, mobile first viewport, and rendering QA risks found inside this worker area.
- Do not stop after listing a template/editor risk if it can be fixed safely within owned files.
- Ask only for product copy decisions that change the business offer, cross-worker files, or changes outside this worker boundary.

## Active Templates

Only these three templates are active:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Korean working names:

1. 개인회생 상담.
2. 모바일 청첩장.
3. 분양 랜딩.

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

## Next Assignment After Current Passing Patch

If the current template/editor patch is already passing QA, continue with these items instead of waiting for another handoff.

1. Three-template depth pass
   - Keep exactly three active templates: 개인회생, 모바일 청첩장, 분양.
   - Make each first viewport look like a finished service page, not a generic sample shell.
   - Remove public copy that sounds like explanation, instruction, usage guide, placeholder, sample text, or feature description.
   - Do not add extra templates to solve quality problems. Improve the three existing templates deeply.

2. Personal rehabilitation template
   - Strengthen the flow as a real 상담 DB landing page: trust signal, eligibility, debt situation, consultation benefit, form, FAQ, bottom CTA.
   - Keep wording careful and compliant. Do not promise approval, debt reduction, legal result, or guaranteed outcome.
   - Form labels must collect useful 상담 data without feeling like a fake demo.

3. Mobile wedding invitation template
   - Make the page feel like a real mobile invitation: couple names, date/time, venue, gallery, RSVP, message, contact/account section if present.
   - Effects should be subtle and premium. Petals/snow/sparkle must be randomized, layered over imagery when appropriate, and must not block text.
   - Keep background/effect controls responsive in preview, including scroll behavior.

4. Real estate presale template
   - Make it read like a real 분양/방문예약 page: project name, location, premium points, type/benefit, gallery or image emphasis, map, visit reservation, FAQ/bottom CTA.
   - Do not rely on vague luxury wording only. Use sections that would make sense for an actual ad landing page.
   - Map fallback must be clear when an exact address is missing, but public copy should not look like a test fixture.

5. Editor and preview polish
   - Continue fixing block-specific style controls where text color, background, font, underline, layout, or effect settings do not reflect live immediately.
   - Keep cards block at `1/2` columns only. Do not reintroduce 3 columns.
   - Preview must scroll normally after effects are enabled.
   - Topnav, CTA chips, form fields, map, gallery, and bottom bar must fit mobile without overlap.

6. QA expansion
   - Add focused rendering/browser QA when a visible template/editor behavior changes.
   - Each of the three templates needs first-viewport coverage.
   - If premium effects change, assert that the effect layer exists, has multiple randomized particles, and does not create blank/error/overflow screens.

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
- Extra template/editor risks found and patched.
- Confirmation that every visible section remains editable.
- Confirmation that no instructional/sample copy remains.
- Screenshots or browser QA case names if visual QA was run.

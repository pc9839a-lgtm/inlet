import { LANDING_TEMPLATES, createTemplatePage, templateInputPatch } from '../src/templates/landingTemplates.js';

const EDITABLE_TYPES = new Set([
  'topnav',
  'hero',
  'image',
  'text',
  'cards',
  'map',
  'schedule',
  'faq',
  'links',
  'download',
  'timer',
  'activity',
  'spacer',
  'divider',
  'form',
  'reservation',
  'bottombar',
  'footer',
]);

const EXPECTED_TEMPLATES = [
  ['debt-relief-consult', 'form'],
  ['wedding-invitation', 'form'],
  ['quote-request', 'form'],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function targetOk(target, ids, anchors = new Set()) {
  if (!target) return true;
  if (['form', 'reservation', 'hero', 'faq', 'phone', 'url'].includes(target)) return true;
  if (String(target).startsWith('block:')) return ids.has(String(target).slice(6));
  if (anchors.has(String(target))) return true;
  return false;
}

function hasMojibake(text) {
  return /[占썽뜮醫딂쳸멨칰삭눧紐꾩벥]/u.test(String(text || ''));
}

let checks = 0;

assert(LANDING_TEMPLATES.length === 3, `expected exactly 3 primary templates, got ${LANDING_TEMPLATES.length}`);
checks += 1;

const templateNames = new Set(LANDING_TEMPLATES.map((template) => template.name));
const templateCtas = new Set(LANDING_TEMPLATES.map((template) => template.cta));
assert(templateNames.size === LANDING_TEMPLATES.length, 'template names must be distinct');
assert(templateCtas.size === LANDING_TEMPLATES.length, 'template CTA labels must be distinct');
checks += 2;

for (const [templateId, conversionType] of EXPECTED_TEMPLATES) {
  const template = LANDING_TEMPLATES.find((item) => item.id === templateId);
  assert(template, `${templateId}: template missing`);
  assert(template.metadata?.conversion === conversionType, `${templateId}: conversion metadata mismatch`);
  checks += 2;
}

for (const template of LANDING_TEMPLATES) {
  const page = createTemplatePage(template.id);
  const ids = new Set(page.blocks.map((block) => block.id));
  const anchors = new Set(page.blocks.map((block) => block.s?.anchorId).filter(Boolean));
  const editableBlocks = page.blocks.filter((block) => EDITABLE_TYPES.has(block.type));
  const blockTypes = page.blocks.map((block) => block.type);
  const heroBlock = page.blocks.find((block) => block.type === 'hero');
  const topNavBlock = page.blocks.find((block) => block.type === 'topnav');

  assert(page.title === template.name, `${template.id}: page title mismatch`);
  assert(page.blocks.length === editableBlocks.length, `${template.id}: non-editable block generated`);
  assert(ids.size === page.blocks.length, `${template.id}: duplicate block id`);
  assert(blockTypes[0] === 'topnav', `${template.id}: topnav must be first`);
  assert(blockTypes.includes('hero'), `${template.id}: hero missing`);
  assert(blockTypes.includes(template.metadata.conversion), `${template.id}: required conversion block missing`);
  assert(blockTypes.includes('faq'), `${template.id}: faq missing`);
  assert(blockTypes.includes('bottombar'), `${template.id}: bottom CTA missing`);
  assert(blockTypes.includes('footer'), `${template.id}: footer missing`);
  assert(template.category && template.intent, `${template.id}: category/intent metadata missing`);
  assert(template.metadata?.editableOnly === true, `${template.id}: editableOnly metadata missing`);
  assert(Array.isArray(template.metadata?.includedBlocks) && template.metadata.includedBlocks.length >= 6, `${template.id}: includedBlocks metadata too shallow`);
  assert(template.metadata.includedBlocks.every((type) => EDITABLE_TYPES.has(type)), `${template.id}: metadata includes non-editable block`);
  checks += 13;

  assert(heroBlock?.s?.title && heroBlock.s.title.length >= 12, `${template.id}: first viewport service signal missing`);
  assert(heroBlock?.s?.body && heroBlock.s.body.length >= 24, `${template.id}: first viewport reason to act missing`);
  assert(!heroBlock.s.kicker && !Array.isArray(heroBlock.s.badges), `${template.id}: hero contains non-editor decorative copy`);
  const primaryMenuWords = template.intent === 'wedding'
    ? ['축하', '예식', '오시는 길']
    : template.intent === 'quote'
      ? ['상담', '분양', '문의', '예약']
      : ['상담', '문의', '진단'];
  assert(
    topNavBlock?.s?.menus?.some((item) => targetOk(item.target, ids, anchors) && primaryMenuWords.some((word) => item.label.includes(word))),
    `${template.id}: first viewport primary CTA menu missing`,
  );
  checks += 4;

  const faqBlock = page.blocks.find((block) => block.type === 'faq');
  assert(Array.isArray(faqBlock?.s?.items) && faqBlock.s.items.length >= 3, `${template.id}: practical faq missing`);
  assert(faqBlock.s.items.every((item) => item.q?.length >= 8 && item.a?.length >= 20), `${template.id}: faq content too generic`);
  checks += 2;

  const pageText = JSON.stringify(page);
  assert(!hasMojibake(pageText), `${template.id}: generated page contains corrupted text`);
  checks += 1;

  for (const block of page.blocks) {
    assert(block.s && typeof block.s === 'object', `${template.id}: ${block.type} has no editable settings`);
    assert(block.visible !== false, `${template.id}: ${block.type} hidden by default`);
    checks += 2;

    if (block.type === 'topnav') {
      assert(Array.isArray(block.s.menus) && block.s.menus.length >= 2, `${template.id}: topnav menus missing`);
      assert(block.s.menus.every((item) => item.id && item.label && targetOk(item.target, ids, anchors)), `${template.id}: broken topnav target`);
      checks += 2;
    }

    if (block.type === 'form') {
      const minQuestions = template.intent === 'wedding' ? 2 : 4;
      assert(Array.isArray(block.s.questions) && block.s.questions.length >= minQuestions, `${template.id}: form questions too shallow`);
      assert(block.s.questions.every((item) => item.id && item.label && item.type), `${template.id}: form question not editable`);
      checks += 2;
    }

    if (block.type === 'hero' || block.type === 'image') {
      assert(block.s.image, `${template.id}: ${block.type} image missing`);
      checks += 1;
    }

    if (block.type === 'reservation') {
      assert(Array.isArray(block.s.customFields) && block.s.customFields.length >= 2, `${template.id}: reservation custom fields missing`);
      assert(block.s.customFields.every((item) => item.id && item.label && item.type), `${template.id}: reservation field not editable`);
      checks += 2;
    }

    if (block.type === 'links') {
      assert(Array.isArray(block.s.items) && block.s.items.length >= 1, `${template.id}: links empty`);
      assert(block.s.items.every((item) => item.id && item.label && targetOk(item.target, ids, anchors)), `${template.id}: broken link target`);
      checks += 2;
    }

    if (block.type === 'bottombar') {
      assert(Array.isArray(block.s.buttons) && block.s.buttons.length >= 1, `${template.id}: bottom bar empty`);
      assert(block.s.buttons.every((item) => item.id && item.label && targetOk(item.target, ids, anchors)), `${template.id}: broken bottom bar target`);
      checks += 2;
    }
  }

  const inputPatch = templateInputPatch(template);
  assert(inputPatch.goal && inputPatch.contactMethod, `${template.id}: template input patch incomplete`);
  assert(!hasMojibake(`${inputPatch.goal} ${inputPatch.contactMethod}`), `${template.id}: template input patch text is corrupted`);
  checks += 2;
}

console.log(JSON.stringify({ ok: true, templates: LANDING_TEMPLATES.length, checks }, null, 2));

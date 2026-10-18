import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDuplicatedPage } from '../src/lib/pageDuplication.js';
import {
  changeTargetMode,
  getSafePhoneUrl,
  getTargetControlState,
  isValidWidgetTarget,
  normalizeTarget,
} from '../src/editor/targetControlModel.js';
import { normalizeBottomTarget } from '../src/editor/blockEditors/bottomBarEditorModel.js';
import { resolveBottomLinkTarget } from '../src/editor/blockEditors/bottomLinkTargetModel.js';
import { normalizeLinkItem } from '../src/editor/blockEditors/linksEditorModel.js';

const source = {
  title: '원본',
  slug: 'original',
  blocks: [
    {
      id: 'nav-original', type: 'topnav', s: {
        menus: [{ id: 'menu-original', label: '문의', target: 'block:form-original' }],
        menusV2: [{ id: 'menu-extra', label: '소개', target: 'block:hero-original' }],
      },
    },
    { id: 'hero-original', type: 'hero', s: { title: '안내' } },
    { id: 'form-original', type: 'form', s: { title: '문의', questions: [] } },
    {
      id: 'links-original', type: 'links', s: { items: [
        { id: 'link-original', label: '문의', target: 'block:form-original', lastWidgetTarget: 'block:hero-original' },
        { id: 'phone-original', label: '전화', target: 'phone', url: 'tel:01012345678', lastWidgetTarget: 'block:form-original' },
        { id: 'broken-original', label: '끊어진 링크', target: 'block:deleted-original' },
      ] },
    },
    {
      id: 'bottom-original', type: 'bottombar', s: { count: 2, buttons: [
        { id: 'cta-original', label: '문의', target: 'block:form-original', lastWidgetTarget: 'block:hero-original' },
        { id: 'phone-cta', label: '전화', target: 'phone', url: 'tel:0212345678', lastWidgetTarget: 'block:form-original' },
      ] },
    },
    {
      id: 'timer-original', type: 'timer', s: { ctaTarget: 'block:form-original', ctaUrl: '' },
    },
  ],
};
const copy = createDuplicatedPage(source, { title: '복제본', slug: 'copied' });
const originals = new Map(source.blocks.map((block) => [block.type, block]));
const cloned = new Map(copy.blocks.map((block) => [block.type, block]));
const newIds = new Set(copy.blocks.map((block) => block.id));
assert.equal(newIds.size, copy.blocks.length, 'cloned block IDs must be unique');
for (const block of source.blocks) {
  const newBlock = cloned.get(block.type);
  assert.ok(newBlock?.id && newBlock.id !== block.id, `the ${block.type} ID must change`);
}
const clonedFormTarget = `block:${cloned.get('form').id}`;
const clonedHeroTarget = `block:${cloned.get('hero').id}`;
assert.equal(cloned.get('topnav').s.menus[0].target, clonedFormTarget, 'menu target must follow cloned form');
assert.equal(cloned.get('topnav').s.menusV2[0].target, clonedHeroTarget, 'extended menu target must follow cloned hero');
assert.notEqual(cloned.get('topnav').s.menus[0].id, originals.get('topnav').s.menus[0].id, 'nested menu ID must refresh');
assert.equal(cloned.get('links').s.items[0].target, clonedFormTarget, 'link target must follow cloned form');
assert.equal(cloned.get('links').s.items[0].lastWidgetTarget, clonedHeroTarget, 'remembered link widget must follow clone');
assert.equal(cloned.get('links').s.items[1].target, 'phone', 'phone target must stay a phone action');
assert.equal(cloned.get('links').s.items[1].url, 'tel:01012345678', 'phone number must survive duplication');
assert.equal(cloned.get('links').s.items[1].lastWidgetTarget, clonedFormTarget, 'phone link remembered target must follow clone');
assert.equal(cloned.get('links').s.items[2].target, 'block:deleted-original', 'already broken refs must not be silently remapped');
assert.equal(cloned.get('bottombar').s.buttons[0].target, clonedFormTarget, 'bottom CTA must follow cloned form');
assert.equal(cloned.get('bottombar').s.buttons[0].lastWidgetTarget, clonedHeroTarget, 'bottom CTA saved target must follow clone');
assert.equal(cloned.get('bottombar').s.buttons[1].target, 'phone', 'bottom phone must stay a phone action');
assert.equal(cloned.get('bottombar').s.buttons[1].lastWidgetTarget, clonedFormTarget, 'bottom phone remembered target must follow clone');
assert.equal(cloned.get('timer').s.ctaTarget, clonedFormTarget, 'timer CTA must follow cloned form');

for (const target of [
  cloned.get('topnav').s.menus[0].target,
  cloned.get('topnav').s.menusV2[0].target,
  cloned.get('links').s.items[0].target,
  cloned.get('bottombar').s.buttons[0].target,
  cloned.get('timer').s.ctaTarget,
]) {
  assert.ok(isValidWidgetTarget(target, copy.blocks), `cloned target ${target} must resolve on cloned page`);
}
assert.ok(!newIds.has('form-original'), 'original form must not be in cloned page');

const page = { blocks: [
  { id: 'hero-a', type: 'hero', s: { anchorId: 'intro' } },
  { id: 'form-b', type: 'form', s: { anchorId: 'contact' } },
  { id: 'bottom-c', type: 'bottombar' },
] };
const selectable = page.blocks.filter((block) => block.type !== 'bottombar');
assert.equal(normalizeTarget('form', selectable), 'block:form-b', 'legacy type target must stay editable');
assert.equal(normalizeTarget('contact', selectable), 'block:form-b', 'legacy anchor target must stay editable');
assert.equal(normalizeTarget('form-b', selectable), 'block:form-b', 'legacy direct ID must stay editable');
assert.equal(normalizeBottomTarget('phone', selectable), 'phone', 'phone must not become first widget');
assert.equal(getTargetControlState({ page, target: 'phone' }).mode, 'phone', 'phone mode must be explicit');
assert.equal(resolveBottomLinkTarget({ target: 'phone', url: 'tel:01077778888' }, selectable).mode, 'phone', 'bottom phone mode must be explicit');

for (const invalidTarget of ['block:removed', 'unknown-widget', '']) {
  const state = getTargetControlState({ page, target: invalidTarget });
  assert.equal(state.mode, 'widget', 'invalid widget references must remain visible in widget mode');
  assert.equal(state.invalidWidgetTarget, true, 'invalid widget references require correction');
  assert.equal(state.currentWidget, invalidTarget, 'invalid reference cannot fall back to first widget');
  const bottom = resolveBottomLinkTarget({ target: invalidTarget }, selectable);
  assert.equal(bottom.invalidWidgetTarget, true, 'bottom invalid target must require correction');
  assert.equal(bottom.currentWidget, invalidTarget, 'bottom invalid target cannot silently change');
}
assert.equal(getTargetControlState({ page, target: 'block:form-b' }).invalidWidgetTarget, false);

let action = {
  target: 'phone',
  url: 'tel:01012345678',
  lastUrl: 'https://example.com/contact',
  lastWidgetTarget: 'block:form-b',
};
const toUrl = changeTargetMode({
  ...action, mode: 'phone', nextMode: 'url', currentWidget: action.lastWidgetTarget,
});
assert.equal(toUrl.target, 'url');
assert.equal(toUrl.url, 'https://example.com/contact');
assert.equal(toUrl.lastPhoneUrl, 'tel:01012345678');

const toWidget = changeTargetMode({
  ...toUrl, mode: 'url', nextMode: 'widget', currentWidget: toUrl.lastWidgetTarget,
});
assert.equal(toWidget.target, 'block:form-b');
assert.equal(toWidget.lastUrl, 'https://example.com/contact');

const backToPhone = changeTargetMode({
  ...toWidget, mode: 'widget', nextMode: 'phone', currentWidget: toWidget.lastWidgetTarget,
});
assert.equal(backToPhone.url, 'tel:01012345678', 'phone must survive url and widget modes');

const backToUrl = changeTargetMode({
  ...backToPhone, mode: 'phone', nextMode: 'url', currentWidget: backToPhone.lastWidgetTarget,
});
assert.equal(backToUrl.url, 'https://example.com/contact', 'web URL must survive phone and widget modes');
assert.equal(getSafePhoneUrl('010-1234-5678'), 'tel:010-1234-5678', 'number-only legacy phone must retain dialing behavior');
assert.equal(normalizeLinkItem({
  target: 'phone', url: 'tel:01012345678',
  lastUrl: 'https://example.com/contact', lastPhoneUrl: 'tel:01012345678',
}).lastUrl, 'https://example.com/contact', 'link editing must preserve remembered URL');

for (const path of ['src/editor/TargetModeTabs.jsx', 'src/editor/blockEditors/BottomLinkModeTabs.jsx']) {
  const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(text, /aria-pressed=\{mode === key\}/, `${path}: mode needs accessible selection state`);
  assert.match(text, /\['phone',/, `${path}: phone mode must be selectable`);
}
for (const path of ['src/editor/TargetWidgetSelect.jsx', 'src/editor/blockEditors/BottomWidgetTargetSelect.jsx']) {
  const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(text, /aria-invalid=\{invalid\}/, `${path}: broken references need aria-invalid`);
  assert.match(text, /role="alert"/, `${path}: broken references need a visible message`);
}
console.log('editor copy/link target QA: duplicate refs, modes, phone memory, broken refs and aria state passed');

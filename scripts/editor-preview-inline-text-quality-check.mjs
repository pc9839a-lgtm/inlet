import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canInlineEditTextMarkup,
  decodeInlineTextMarkup,
  encodeInlineTextMarkup,
  patchInlineTextBlock,
} from '../src/editor/previewInlineTextModel.js';

assert.equal(canInlineEditTextMarkup('제목 &amp; 문구'), true);
assert.equal(canInlineEditTextMarkup('첫 줄<br>둘째 줄'), true);
assert.equal(canInlineEditTextMarkup('<strong>서식 있는 제목</strong>'), false);
assert.equal(canInlineEditTextMarkup('<span style="color:red">색상</span>'), false);
assert.equal(canInlineEditTextMarkup('<script>alert(1)</script>'), false);
assert.equal(canInlineEditTextMarkup('저작권 &copy; 문구'), false, 'unknown named entities must not be re-encoded');
assert.equal(canInlineEditTextMarkup(''), false);

const original = '안내 &amp; 방법<br>둘째 &lt;줄&gt; &#x1f600;';
assert.equal(decodeInlineTextMarkup(original), '안내 & 방법\n둘째 <줄> 😀');
assert.equal(encodeInlineTextMarkup('A&B <C> "D"\n두 줄'), 'A&amp;B &lt;C&gt; "D"<br>두 줄');
assert.equal(encodeInlineTextMarkup(''), '');
assert.equal(decodeInlineTextMarkup('사과&#39;배'), "사과'배");

const page = {
  title: '페이지',
  blocks: [
    { id: 'a', type: 'text', visible: true, s: { title: '처음', body: '첫 줄<br>둘째', align: 'left' } },
    { id: 'b', type: 'code', s: { html: '<b>위젯</b>' } },
    { id: 'c', type: 'text', s: { title: '<strong>서식</strong>', body: '그대로' } },
  ],
};
const previous = JSON.stringify(page);
const args = { blockId: 'a', field: 'title', previousHtml: '처음', nextHtml: '바뀜 &amp; 확인' };
const changed = patchInlineTextBlock(page, args);
assert.notEqual(changed, page);
assert.equal(changed.blocks[0].s.title, '바뀜 &amp; 확인');
assert.equal(changed.blocks[0].s.body, '첫 줄<br>둘째', 'other fields remain intact');
assert.equal(changed.blocks[0].s.align, 'left');
assert.equal(changed.blocks[1], page.blocks[1], 'unrelated code stays byte-identical');
assert.equal(changed.blocks[2], page.blocks[2]);
assert.equal(JSON.stringify(page), previous, 'draft updates must not mutate source objects');
assert.equal(patchInlineTextBlock(changed, args), changed, 'stale editor must not overwrite a newer title');
assert.equal(patchInlineTextBlock(page, { ...args, blockId: 'missing' }), page);
assert.equal(patchInlineTextBlock(page, { ...args, blockId: 'b' }), page, 'code cannot be inline edited');
assert.equal(patchInlineTextBlock(page, { ...args, field: 'html' }), page);
assert.equal(patchInlineTextBlock(page, { ...args, nextHtml: '처음' }), page);
assert.equal(patchInlineTextBlock(page, { ...args, nextHtml: '<script>x</script>' }), page);
assert.equal(patchInlineTextBlock(page, { ...args, blockId: 'c', previousHtml: '<strong>서식</strong>' }), page);
const cleared = patchInlineTextBlock(page, { ...args, nextHtml: '' });
assert.equal(cleared.blocks[0].s.title, '', 'clearing a field must remain possible');
const bodyChanged = patchInlineTextBlock(page, {
  blockId: 'a', field: 'body', previousHtml: '첫 줄<br>둘째', nextHtml: '변경<br>확인',
});
assert.equal(bodyChanged.blocks[0].s.body, '변경<br>확인');

const integration = {
  renderer: readFileSync('src/preview/LandingRenderer.jsx', 'utf8'),
  fields: readFileSync('src/preview/renderers/ContentBlocks.jsx', 'utf8'),
  screen: readFileSync('src/screens/WorkspaceEditorScreen.jsx', 'utf8'),
  pane: readFileSync('src/screens/workspace/WorkspacePreviewPane.jsx', 'utf8'),
  inline: readFileSync('src/preview/EditorInlineTextField.jsx', 'utf8'),
};
assert.ok(integration.renderer.includes('onEditPreviewText={editorPreview ? onEditPreviewText : undefined}'),
  'editing must be unavailable to published/template render paths');
assert.ok(integration.fields.includes('canInlineEditTextMarkup(s.title)'));
assert.ok(integration.fields.includes('canInlineEditTextMarkup(s.body)'));
assert.ok(integration.pane.includes('onEditPreviewText={onEditPreviewText}'));
assert.ok(integration.screen.includes('settingsPanelProps.setPage((latest) => patchInlineTextBlock(latest,'),
  'draft updates must use the functional latest-page updater');
assert.ok(integration.inline.includes("event.nativeEvent?.isComposing"), 'IME composition must not be committed as Enter');
assert.ok(integration.inline.includes("onKeyDown={enabled ?"), 'keyboard activation required');
assert.ok(integration.inline.includes('onDoubleClick={enabled ?'), 'direct canvas editing required');
console.log('Editor inline text: plain/rich boundary, escape, CRLF, stale writes, field isolation, draft wiring passed');

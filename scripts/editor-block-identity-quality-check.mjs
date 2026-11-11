import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createScreenOrderIdentities, isExplicitlyHidden } from '../src/editor/editPanelParts/screenOrderIdentityModel.js';
import { findBlockNavigationMatches } from '../src/editor/editPanelParts/blockNavigatorSearchModel.js';

const blocks = [
  { id: 'text-a', type: 'text', s: { title: '<strong>첫 번째 소개</strong>' } },
  { id: 'image-b', type: 'image', s: { mode: 'gallery', gallery: [{ url: '/api/files/photo.webp' }], caption: '상담 공간' } },
  { id: 'text-c', type: 'text', s: { title: '두 번째 소개' } },
  { id: 'code-d', type: 'code', s: { editorLabel: '채팅 링크', html: '<div>ignored</div>' } },
  { id: 'image-e', type: 'image', s: { image: 'javascript:alert(1)', caption: '그림 없음' } },
  { id: 'code-f', type: 'code', s: { editorLabel: '고객 후기' } },
  { id: 'spacer-g', type: 'spacer', s: {} },
  { id: 'hero-h', type: 'hero', s: { title: '<b>대표 서비스</b>', body: '세 가지 혜택' } },
  { id: 'form-i', type: 'form', s: { title: '상담 요청', questions: [{ id: 'q1' }, { id: 'q2' }], submit: '무료 문의' } },
  { id: 'links-j', type: 'links', s: { items: [{ label: '서비스 문의' }, { label: '예약 안내' }] } },
];
const snapshot = JSON.stringify(blocks);
const identities = createScreenOrderIdentities(blocks);
assert.equal(JSON.stringify(blocks), snapshot, 'identity model must not mutate stored page data');
assert.equal(identities.length, blocks.length);
assert.deepEqual(identities.filter((_, i) => blocks[i].type === 'text').map((v) => v.occurrence), [1, 2]);
assert.deepEqual(identities.filter((_, i) => blocks[i].type === 'text').map((v) => v.repeated), [true, true]);
assert.equal(identities[0].detail, '첫 번째 소개', 'HTML formatting in rich text must not leak into labels');
assert.equal(identities[2].detail, '두 번째 소개', 'title detail must distinguish repeated types');
assert.equal(identities[1].thumbnail, '/api/files/photo.webp', 'gallery first image should be shown as a thumbnail');
assert.equal(identities[1].detail, '상담 공간');
assert.equal(identities[4].thumbnail, '', 'unsafe protocols must not be loaded in an image tag');
assert.equal(identities[3].customLabel, '채팅 링크', 'existing code custom labels remain visible');
assert.equal(identities[5].customLabel, '고객 후기');
assert.equal(identities[6].repeated, false, 'singletons should not gain unnecessary numbering');

assert.equal(identities[0].contentTitle, '첫 번째 소개');
assert.equal(identities[2].contentTitle, '두 번째 소개');
assert.equal(identities[7].contentTitle, '대표 서비스', 'content-first hero title must strip markup');
assert.equal(identities[7].contentSummary, '세 가지 혜택');
assert.equal(identities[8].contentTitle, '상담 요청');
assert.equal(identities[8].contentSummary, '질문 2개 · 무료 문의');
assert.equal(identities[9].contentTitle, '서비스 문의');
assert.equal(identities[9].contentSummary, '링크 2개');
assert.equal(identities[3].contentTitle, '', 'custom code identity keeps user-defined label');
assert.equal(JSON.stringify(blocks), snapshot, 'content identity remains purely derived');
for (const [query, expected] of [
  ['대표 서비스', 'hero-h'],
  ['세 가지 혜택', 'hero-h'],
  ['질문 2개', 'form-i'],
  ['무료 문의', 'form-i'],
  ['서비스 문의', 'links-j'],
]) {
  assert.deepEqual(findBlockNavigationMatches({ blocks, query }).map((m) => m.id), [expected],
    'content-led search should locate exact editor blocks: ' + query);
}
const reordered = [blocks[2], blocks[1], blocks[0], blocks[3], blocks[4], blocks[5], blocks[6]];
assert.equal(createScreenOrderIdentities(reordered)[0].occurrence, 1, 'order numbering should reflect the current screen order');
assert.equal(createScreenOrderIdentities(reordered)[2].occurrence, 2);
assert.equal(createScreenOrderIdentities([blocks[0]])[0].repeated, false, 'removed duplicates should remove numbering');
assert.equal(createScreenOrderIdentities([]).length, 0);
assert.equal(createScreenOrderIdentities(null).length, 0);
const imageCases = [
  'https://example.com/photograph.jpg', 'data:image/png;base64,aGVsbG8=',
  '//outside.test/image.png', 'data:image/svg+xml;base64,PHN2Zz4=',
];
const result = createScreenOrderIdentities(imageCases.map((image, i) => ({ id: `image-${i}`, type: 'image', s: { image } })));
assert.ok(result[0].thumbnail.startsWith('https://'));
assert.ok(result[1].thumbnail.startsWith('data:image/png;'));
assert.equal(result[2].thumbnail, '', 'protocol-relative image sources are not rendered as thumbnails');
assert.equal(result[3].thumbnail, '', 'SVG data images are not previewed in the editor row');
// Legacy/imported blocks may omit visible. Match sanitizeBlock's default
// and the existing action menu: only explicit false means hidden.
assert.equal(isExplicitlyHidden({ id: 'legacy' }), false);
assert.equal(isExplicitlyHidden({ visible: true }), false);
assert.equal(isExplicitlyHidden({ visible: false }), true);
assert.equal(isExplicitlyHidden({ visible: null }), false);
for (const file of ['ScreenOrderRowIdentity.jsx', 'ScreenOrderRow.jsx', 'ScreenOrderSettings.jsx']) {
  const source = readFileSync('src/editor/editPanelParts/' + file, 'utf8');
  assert.ok(source.includes('isExplicitlyHidden'), file + ' must use the canonical hidden-state rule');
  assert.ok(!source.includes('!block.visible'), file + ' must not treat absent visible as hidden');
}
const blockActions = readFileSync('src/runtime/useEditorBlockActions.js', 'utf8');
assert.ok(blockActions.includes('visible: b.visible === false'), 'first toggle must hide a default-visible block');
assert.ok(!blockActions.includes('visible: !b.visible'), 'legacy missing visible must not toggle to visible');
console.log('Visibility default: missing/true remain shown, explicit false hidden, toggle consistency passed');
console.log('D03 block identity: repeated labels, rich-text titles, safe thumbnails, live order and no page mutation passed');

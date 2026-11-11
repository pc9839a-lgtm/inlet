import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { insertBlocksAfterSelection } from '../src/runtime/insertEditorBlocks.js';

const blocks = [
  { id: 'top', type: 'topnav' },
  { id: 'hero', type: 'hero' },
  { id: 'text', type: 'text' },
  { id: 'photo', type: 'image' },
  { id: 'bottom', type: 'bottombar' },
  { id: 'footer', type: 'footer' },
];
const x = { id: 'x', type: 'text' };
const y = { id: 'y', type: 'image' };
const ids = (value) => value.map((block) => block.id).join(',');

assert.equal(ids(insertBlocksAfterSelection(blocks, [x], 'hero')),
  'top,hero,x,text,photo,bottom,footer', 'insert immediately after selection');
assert.equal(ids(insertBlocksAfterSelection(blocks, [x, y], 'text')),
  'top,hero,text,x,y,photo,bottom,footer', 'preserve pattern block order');
assert.equal(ids(insertBlocksAfterSelection(blocks, [x], 'photo')),
  'top,hero,text,photo,x,bottom,footer', 'last normal block inserts before fixed bottom');
assert.equal(ids(insertBlocksAfterSelection(blocks, [x], 'top')),
  'top,x,hero,text,photo,bottom,footer', 'topnav selection inserts at content start');
for (const selected of ['', 'missing', 'bottom', 'footer']) {
  assert.equal(ids(insertBlocksAfterSelection(blocks, [x], selected)),
    'top,hero,text,photo,x,bottom,footer', 'no normal selection appends before bottom fixed: ' + selected);
}
assert.equal(ids(insertBlocksAfterSelection([{ id: 'a', type: 'text' }], [x], 'a')), 'a,x');
assert.equal(ids(insertBlocksAfterSelection([{ id: 'a', type: 'text' }], [x], 'missing')), 'a,x');
assert.equal(ids(insertBlocksAfterSelection([{ id: 'top', type: 'topnav' }], [x], 'top')), 'top,x');
assert.equal(insertBlocksAfterSelection(blocks, [], 'hero'), blocks, 'no additions must preserve identity');
assert.equal(ids(blocks), 'top,hero,text,photo,bottom,footer', 'the original ordered collection must not be mutated');
assert.equal(insertBlocksAfterSelection(blocks, [x], 'hero')[1], blocks[1], 'existing blocks retain identity');

const actions = readFileSync('src/runtime/useEditorBlockActions.js', 'utf8');
const dock = readFileSync('src/editor/editPanelParts/AddBlockDock.jsx', 'utf8');
const layout = readFileSync('src/editor/EditPanelLayout.jsx', 'utf8');
const renderer = readFileSync('src/preview/LandingRenderer.jsx', 'utf8');
const screen = readFileSync('src/screens/WorkspaceEditorScreen.jsx', 'utf8');
const media = readFileSync('src/preview/renderers/MediaBlocks.jsx', 'utf8');
assert.ok(actions.includes('insertBlocksAfterSelection(p.blocks, [block], openId)'), 'single block must insert after selected');
assert.ok(actions.includes('insertBlocksAfterSelection(p.blocks, blocks, openId)'), 'pattern must insert after selected');
assert.ok(dock.includes('선택한 블록 아래에 추가'), 'catalog must explain insertion position');
const dockProps = readFileSync('src/editor/editPanelSectionProps/addBlockDockProps.js', 'utf8');
assert.ok(dockProps.includes('afterSelected: normalBlocks.some'), 'only normal selection claims below');
assert.ok(layout.includes('<AddBlockDock {...addBlockDockProps} compact />'), 'keep existing composition add dock API');
assert.ok(renderer.includes("section.classList.contains('image-sec')"), 'only image block click requests upload focus');
assert.ok(renderer.includes('!event.target.closest?.'), 'image gallery control clicks must be left alone');
assert.ok(screen.includes("document.getElementById(\`editor-block-settings-\${id}\`)"), 'preview must focus matching inspector block');
assert.ok(screen.includes('.image-input-upload-action:not([disabled])'), 'existing upload button is reused');
assert.ok(media.includes("title={editorPreview ? '클릭하면 사진 변경 설정으로 이동' : undefined}"),
  'editor photo hint must not reach public page');
console.log('Editor selected insertion and image-picker focus contract passed');

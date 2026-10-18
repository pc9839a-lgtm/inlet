import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Focused, non-network regression checks for critical editor data integrity.
// Run with: node scripts/editor-data-integrity-regression-check.mjs
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const stripModuleSyntax = (source) => source
  .replace(/^import .*;\s*$/gm, '')
  .replace(/^export /gm, '');

function checkDownloadConcurrentEdits() {
  const source = read('src/editor/blockEditors/useDownloadItems.js');
  const useDownloadItems = new Function(
    'normalizeDownloadItem',
    'createDownloadItem',
    stripModuleSyntax(source) + '\nreturn useDownloadItems;',
  )(
    (item) => ({ id: item.id, title: item.title || '자료', desc: item.desc || '', fileUrl: item.fileUrl || '' }),
    (index) => ({ id: 'added-' + index, title: '자료' }),
  );
  let settings = { items: [{ id: 'first', title: 'before' }] };
  const set = (patch) => {
    const result = typeof patch === 'function' ? patch(settings) : patch;
    if (result) settings = { ...settings, ...result };
  };
  const oldRender = useDownloadItems(settings, set);
  oldRender.addItem();
  useDownloadItems(settings, set).updateItem('first', { title: 'edited during upload', desc: 'new' });
  oldRender.updateItem('first', { fileUrl: '/file.pdf' });
  assert.equal(settings.items.length, 2, 'upload completion must preserve added items');
  assert.equal(settings.items[0].title, 'edited during upload', 'upload completion must preserve latest title');
  assert.equal(settings.items[0].desc, 'new', 'upload completion must preserve latest description');
  assert.equal(settings.items[0].fileUrl, '/file.pdf');
  useDownloadItems(settings, set).removeItem('first');
  oldRender.updateItem('first', { fileUrl: '/stale.pdf' });
  assert.equal(settings.items.length, 1, 'deleted upload item must never reappear');

  const upload = read('src/editor/blockEditors/useDownloadFileUpload.js');
  assert.match(upload, /uploadGenerationRef/);
  assert.match(upload, /if \(generation !== uploadGenerationRef\.current\) return;/);
  assert.doesNotMatch(upload, /onChange\(\{ \.\.\.patch, fileUrl:/);
}

function checkCopiedLinks() {
  const source = stripModuleSyntax(read('src/lib/pageDuplication.js'));
  const uid = (() => { let next = 0; return () => 'duplicate-' + (++next); })();
  const duplicate = new Function(
    'clone', 'ensureUniqueAnchors', 'normalizePageForSave', 'uid',
    source + '\nreturn createDuplicatedPage;',
  )(
    (value) => JSON.parse(JSON.stringify(value)),
    (blocks) => blocks,
    (page) => page,
    uid,
  );
  const original = {
    title: 'source',
    slug: 'source',
    blocks: [
      { id: 'button-id', type: 'hero', s: { buttons: [
        { id: 'button1', target: 'block:form-id' },
        { id: 'button2', target: 'phone', url: 'tel:01000000000' },
        { id: 'button3', target: 'url', url: 'https://example.com' },
        { id: 'button4', href: '#block:ignored' },
      ] } },
      { id: 'form-id', type: 'form', s: {} },
    ],
  };
  const copy = duplicate(original, { slug: 'copy' });
  assert.notEqual(copy.blocks[1].id, original.blocks[1].id);
  assert.equal(copy.blocks[0].s.buttons[0].target, 'block:' + copy.blocks[1].id);
  assert.equal(copy.blocks[0].s.buttons[1].target, 'phone');
  assert.equal(copy.blocks[0].s.buttons[1].url, 'tel:01000000000');
  assert.equal(copy.blocks[0].s.buttons[2].url, 'https://example.com');
  assert.equal(original.blocks[0].s.buttons[0].target, 'block:form-id');
}

function checkDraftAndPreviewContracts() {
  const pane = read('src/screens/workspace/WorkspacePreviewPane.jsx');
  const renderer = read('src/preview/LandingRenderer.jsx');
  const forms = read('src/preview/renderers/FormBlocks.jsx');
  const save = read('src/runtime/usePageSaveAction.js');
  const styleSave = read('src/runtime/usePersistStyleSaveAction.js');
  const style = read('src/panels/StylePanel.jsx');
  const code = read('src/editor/blockEditors/CodeEditor.jsx');
  const model = read('src/lib/pageModel.js');

  assert.match(pane, /editorPreview/);
  assert.doesNotMatch(pane, /addLead=\{addLead\}/);
  assert.doesNotMatch(pane, /track=\{track\}/);
  assert.match(renderer, /templatePreview \|\| editorPreview/);
  assert.match(renderer, /if \(!editorPreview\) track\?/);
  assert.equal((forms.match(/isTest: editorPreview \|\| traffic\.isTest/g) || []).length, 2);
  assert.match(save, /if \(hasPendingStyle\)/);
  assert.match(style, /pendingTheme \|\| page\.theme/);
  assert.match(save, /code-draft-not-applied/);
  assert.match(styleSave, /code-draft-not-applied/);
  assert.match(code, /s\.codeDraft/);
  assert.match(model, /s\.codeDraft = typeof/);
}

checkDownloadConcurrentEdits();
checkCopiedLinks();
checkDraftAndPreviewContracts();
process.stdout.write('PASS editor data-integrity regression checks: concurrent uploads, cloned links, staged styles/code, and preview isolation\n');

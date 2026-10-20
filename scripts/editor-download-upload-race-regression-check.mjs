import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Evaluate the actual editor hooks with isolated React and upload fakes.
// No browser, server, fetch, API client or real file upload is loaded.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(path.join(root, file), 'utf8');
function loadSource(file, dependencies, names) {
  const source = read(file)
    .replace(/^\uFEFF/, '')
    .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/\bexport\s+(?=(?:function|const|let|class)\b)/g, '');
  return new vm.Script(`${source}\n;({${names.join(',')}})`, { filename: file })
    .runInNewContext({ ...dependencies, console: { warn() {} } });
}

let uid = 0;
const { normalizeDownloadItem, createDownloadItem, extensionFromName,
  DOWNLOAD_ALLOWED_EXTENSIONS, DOWNLOAD_MAX_BYTES } = loadSource(
  'src/editor/blockEditors/downloadEditorModel.js',
  { pickSafe: (value, allowed, fallback) => allowed.includes(value) ? value : fallback,
    uid: () => `new-${++uid}` },
  ['normalizeDownloadItem', 'createDownloadItem', 'extensionFromName',
    'DOWNLOAD_ALLOWED_EXTENSIONS', 'DOWNLOAD_MAX_BYTES']
);
const { clearDownloadUploadPatch, createDownloadUploadPatch, validateDownloadUploadFile } = loadSource(
  'src/editor/blockEditors/downloadUploadModel.js',
  { formatFileSize: (bytes) => `${bytes} B`, DOWNLOAD_ALLOWED_EXTENSIONS,
    DOWNLOAD_MAX_BYTES, extensionFromName },
  ['clearDownloadUploadPatch', 'createDownloadUploadPatch', 'validateDownloadUploadFile']
);

function hookHarness() {
  const slots = [];
  const effects = [];
  let cursor = 0;
  const react = {
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in effects)) effects[index] = effect();
    },
  };
  return {
    react,
    render(hook, ...args) { cursor = 0; return hook(...args); },
    dispose() { effects.forEach((cleanup) => cleanup?.()); },
  };
}

const notifications = [];
const queuedUploads = [];
const uploadDownloadFile = (file) => new Promise((resolve, reject) => {
  queuedUploads.push({ file, resolve, reject });
});
const loadItems = (react) => loadSource('src/editor/blockEditors/useDownloadItems.js',
  { useRef: react.useRef, normalizeDownloadItem, createDownloadItem }, ['useDownloadItems']).useDownloadItems;
const loadUpload = (react) => loadSource('src/editor/blockEditors/useDownloadFileUpload.js',
  { ...react, uploadDownloadFile, notify: (message, type) => notifications.push({ message, type }),
    clearDownloadUploadPatch, createDownloadUploadPatch, validateDownloadUploadFile },
  ['useDownloadFileUpload']).useDownloadFileUpload;

function editor(initial, { autoRender = true } = {}) {
  const block = { items: initial.map((entry) => ({ ...entry })) };
  let state = block;
  const itemHarness = hookHarness();
  const uploadHarness = hookHarness();
  const useItems = loadItems(itemHarness.react);
  const useUpload = loadUpload(uploadHarness.react);
  let itemApi, uploadApi, disposed = false;
  function rerender() {
    itemApi = itemHarness.render(useItems, state, set);
    const selected = itemApi.items.find((item) => item.id === 'file-1');
    if (!selected) {
      if (!disposed) { uploadHarness.dispose(); disposed = true; }
      uploadApi = null;
      return;
    }
    if (disposed) throw new Error('A removed item must not be remounted under the same id in this test');
    const update = itemApi.updateItem;
    uploadApi = uploadHarness.render(useUpload, {
      item: selected, page: {}, authUser: null,
      onChange: (patch) => update(selected.id, patch),
    });
  }
  function set(patch) {
    assert.equal(typeof patch, 'object', 'BlockEditor.set requires an object patch');
    assert.ok(patch && Array.isArray(patch.items), 'item mutation must carry an items array');
    state = { ...state, ...patch };
    if (autoRender) rerender();
  }
  rerender();
  return {
    state: () => state,
    items: () => itemApi,
    upload: () => uploadApi,
    rerender,
    teardown: () => { if (!disposed) uploadHarness.dispose(); },
  };
}
const item = () => ({ id: 'file-1', title: '자료', desc: '원본 설명', fileName: '', fileUrl: '', extension: 'pdf' });
const file = (name) => ({ name, size: 120 });
const get = (e) => e.state().items.find((entry) => entry.id === 'file-1');
let passed = 0;
async function test(name, run) {
  const before = queuedUploads.length;
  await run();
  assert.ok(queuedUploads.length >= before);
  passed++;
  console.log(`PASS ${name}`);
}

await test('delayed completion preserves edited title, description and newly added item', async () => {
  const e = editor([item()]);
  const pending = e.upload().pick(file('brochure.pdf'));
  const response = queuedUploads.at(-1);
  e.items().updateItem('file-1', { title: '변경한 표시 문구', desc: '업로드 중 바꾼 설명' });
  e.items().addItem();
  response.resolve({ downloadUrl: '/files/new.pdf', size: 125 });
  await pending;
  assert.equal(e.state().items.length, 2, 'newly inserted items must survive');
  assert.equal(get(e).title, '변경한 표시 문구');
  assert.equal(get(e).desc, '업로드 중 바꾼 설명');
  assert.equal(get(e).fileUrl, '/files/new.pdf');
  assert.equal(e.state().items[1].id, 'new-1');
  e.teardown();
});
await test('removed item cannot be resurrected by an old response', async () => {
  const e = editor([item(), { ...item(), id: 'file-2' }]);
  const pending = e.upload().pick(file('first.pdf'));
  const response = queuedUploads.at(-1);
  e.items().removeItem('file-1');
  response.resolve({ downloadUrl: '/files/ghost.pdf' });
  await pending;
  assert.equal(e.state().items.length, 1);
  assert.equal(e.state().items[0].id, 'file-2');
});
await test('clear during upload invalidates its late response', async () => {
  const e = editor([item()]);
  const pending = e.upload().pick(file('first.pdf'));
  const response = queuedUploads.at(-1);
  e.upload().clearFile();
  response.resolve({ url: '/files/ghost.pdf' });
  await pending;
  assert.equal(get(e).fileName, '');
  assert.equal(get(e).fileUrl, '');
  e.teardown();
});
await test('second request wins when first request completes last', async () => {
  const e = editor([item()]);
  const first = e.upload().pick(file('old.pdf'));
  const oldResponse = queuedUploads.at(-1);
  const second = e.upload().pick(file('new.xlsx'));
  const newResponse = queuedUploads.at(-1);
  e.items().updateItem('file-1', { title: '수정 후 문구' });
  newResponse.resolve({ url: '/files/new.xlsx' });
  await second;
  oldResponse.resolve({ url: '/files/old.pdf' });
  await first;
  assert.equal(get(e).fileName, 'new.xlsx');
  assert.equal(get(e).fileUrl, '/files/new.xlsx');
  assert.equal(get(e).title, '수정 후 문구');
  e.teardown();
});
await test('failed replacement cannot reactivate earlier response', async () => {
  const e = editor([item()]);
  const first = e.upload().pick(file('old.pdf'));
  const oldResponse = queuedUploads.at(-1);
  const second = e.upload().pick(file('new.pdf'));
  const failedResponse = queuedUploads.at(-1);
  e.items().updateItem('file-1', { desc: '실패 후에도 유지할 설명' });
  failedResponse.reject(new Error('mock network failure'));
  await second;
  oldResponse.resolve({ url: '/files/old.pdf' });
  await first;
  assert.equal(get(e).fileUrl, '');
  assert.equal(get(e).fileName, '');
  assert.equal(get(e).desc, '실패 후에도 유지할 설명');
  e.teardown();
});
await test('failed upload only clears file metadata, not edits or sibling items', async () => {
  const e = editor([item()]);
  const pending = e.upload().pick(file('unavailable.pdf'));
  const response = queuedUploads.at(-1);
  e.items().updateItem('file-1', { title: '실패 후 문구', desc: '실패 후 설명' });
  e.items().addItem();
  response.reject(new Error('mock failure'));
  await pending;
  assert.equal(e.state().items.length, 2);
  assert.equal(get(e).title, '실패 후 문구');
  assert.equal(get(e).desc, '실패 후 설명');
  assert.equal(get(e).fileName, '');
  assert.equal(get(e).fileUrl, '');
  e.teardown();
});
await test('late rejection cannot clear a successful replacement', async () => {
  const e = editor([item()]);
  const first = e.upload().pick(file('old.pdf'));
  const older = queuedUploads.at(-1);
  const second = e.upload().pick(file('latest.pdf'));
  const newer = queuedUploads.at(-1);
  newer.resolve({ url: '/files/latest.pdf' });
  await second;
  older.reject(new Error('stale error'));
  await first;
  assert.equal(get(e).fileUrl, '/files/latest.pdf');
  e.teardown();
});
await test('external file replacement while pending prevents stale URL merge', async () => {
  const e = editor([item()]);
  const pending = e.upload().pick(file('first.pdf'));
  const response = queuedUploads.at(-1);
  e.items().updateItem('file-1', { fileName: 'other.pdf', fileUrl: '/files/other.pdf' });
  response.resolve({ url: '/files/first.pdf' });
  await pending;
  assert.equal(get(e).fileUrl, '/files/other.pdf');
  assert.equal(get(e).fileName, 'other.pdf');
  e.teardown();
});
await test('invalid file never starts an upload', async () => {
  const e = editor([item()]);
  const count = queuedUploads.length;
  await e.upload().pick(file('invalid.exe'));
  assert.equal(queuedUploads.length, count);
  assert.equal(get(e).fileUrl, '');
  e.teardown();
});
await test('batched mutations from old render rebase without re-render', async () => {
  const e = editor([item()], { autoRender: false });
  const oldHandlers = e.items();
  oldHandlers.updateItem('file-1', { title: 'batch title' });
  oldHandlers.addItem();
  e.rerender();
  assert.equal(get(e).title, 'batch title');
  assert.equal(e.state().items.length, 2);
  e.teardown();
});
await test('missing id is a no-op instead of creating an item', async () => {
  const e = editor([item()]);
  e.items().updateItem('removed-id', { fileUrl: '/files/no.pdf' });
  assert.equal(e.state().items.length, 1);
  assert.equal(get(e).fileUrl, '');
  e.teardown();
});
await test('pending file can be cleared from upload control', async () => {
  const control = read('src/editor/blockEditors/DownloadFileUploadControl.jsx');
  assert.match(control, /\(item\.fileName \|\| item\.fileUrl\) &&/);
  assert.match(control, /className="download-remove-file" onClick=\{onClear\}/);
});

console.log(`Passed ${passed} editor download upload race checks (mock requests only).`);

import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = {
  feedback: await readFile('src/builder/BuilderFeedback.jsx', 'utf8'),
  home: await readFile('src/screens/HomeScreens.jsx', 'utf8'),
  formEditor: await readFile('src/editor/blockEditors/FormEditor.jsx', 'utf8'),
  imageEditor: await readFile('src/editor/blockEditors/ImageEditor.jsx', 'utf8'),
  statsPanel: await readFile('src/panels/StatsPanel.jsx', 'utf8'),
  createModalCss: await readFile('src/styles/panels-create-modal.css', 'utf8'),
};

const dialogContracts = [
  [files.feedback, 'builder feedback dialogs use dialog role', 'role="dialog"'],
  [files.feedback, 'builder feedback dialogs use aria-modal', 'aria-modal="true"'],
  [files.feedback, 'builder feedback dialogs use labelled headings', 'aria-labelledby='],
  [files.feedback, 'builder feedback close buttons are labelled', 'aria-label="닫기"'],
  [files.feedback, 'builder feedback supports Escape close', "event.key === 'Escape'"],
  [files.home, 'create modal uses dialog role', 'role="dialog"'],
  [files.home, 'create modal uses aria-modal', 'aria-modal="true"'],
  [files.home, 'create modal has accessible title', 'aria-labelledby="create-landing-title"'],
  [files.home, 'create modal close button is labelled', 'aria-label="닫기"'],
  [files.home, 'create modal supports Escape close', "event.key === 'Escape'"],
  [files.formEditor, 'HTML modal uses dialog role', 'role="dialog"'],
  [files.formEditor, 'HTML modal uses aria-modal', 'aria-modal="true"'],
  [files.formEditor, 'HTML modal has accessible title', 'aria-labelledby="inlet-html-modal-title"'],
  [files.formEditor, 'HTML modal close button is labelled', 'aria-label="닫기"'],
  [files.formEditor, 'HTML modal supports Escape close', "event.key === 'Escape'"],
  [files.imageEditor, 'image crop modal uses dialog role', 'role="dialog"'],
  [files.imageEditor, 'image crop modal uses aria-modal', 'aria-modal="true"'],
  [files.imageEditor, 'image crop close button is labelled', 'aria-label="닫기"'],
  [files.imageEditor, 'image crop supports Escape close', "event.key === 'Escape'"],
];

for (const [source, label, token] of dialogContracts) {
  assert(source.includes(token), `accessibility contract failed: ${label}`);
}

assert(files.feedback.includes('focusable?.focus?.()'), 'feedback dialogs should focus first interactive control');
assert(files.home.includes('focusable?.focus?.()'), 'create modal should focus first interactive control');
assert(files.formEditor.includes('focusable?.focus?.()'), 'HTML modal should focus first interactive control');
assert(
  files.statsPanel.includes('role="img"') && files.statsPanel.includes('aria-label='),
  'stats chart should expose image role and label'
);
assert(files.statsPanel.includes('role="status"'), 'stats partial notice should use status semantics');
assert(files.createModalCss.includes('.sr-only'), 'screen-reader-only utility should exist for hidden modal titles');

const unlabeledIconButtons = [
  ...files.feedback.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
  ...files.home.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
  ...files.formEditor.matchAll(/<button(?![^>]*(?:aria-label|title|>\s*[\p{L}\p{N}]))[^>]*>\s*[×✕]\s*<\/button>/gu),
];
assert(!unlabeledIconButtons.length, 'icon-only close buttons should have aria-label or title');

console.log(JSON.stringify({
  ok: true,
  checks: dialogContracts.length + 7,
}, null, 2));

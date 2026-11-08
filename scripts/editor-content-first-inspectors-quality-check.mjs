import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');
const text = read('src/editor/blockEditors/TextEditor.jsx');
const image = read('src/editor/blockEditors/ImageEditor.jsx');
const form = read('src/editor/blockEditors/FormEditor.jsx');
const code = read('src/editor/blockEditors/CodeEditor.jsx');
const codeBox = read('src/editor/blockEditors/CodeEditorBox.jsx');
const inspector = read('src/editor/editPanelParts/ScreenOrderSettings.jsx');
const disclosure = read('src/editor/ui/InspectorDisclosure.jsx');
const css = read('src/editor/EditPanelLayout.css');
const browser = read('scripts/editor-reference-browser-check.mjs');

assert(text.indexOf('label="제목"') < text.indexOf('label="본문"')
  && text.indexOf('label="본문"') < text.indexOf('label="디자인 조정"'),
  'title and body precede design');
assert(text.includes('<WidgetSpacingControls s={s} set={set} />')
  && text.indexOf('<WidgetSpacingControls') < text.indexOf('</InspectorDisclosure>'),
  'text spacing lives in one optional design disclosure');
assert(!text.includes('defaultOpen'), 'text visual design must not monopolize first view');
assert(image.indexOf('<ImageBasicSection') < image.indexOf('label="사진 맞춤과 디자인"')
  && image.indexOf('<ImageCaptionSection') < image.indexOf('label="사진 맞춤과 디자인"'),
  'image replacement and caption precede appearance');
assert(image.indexOf('<ImageDisplayControls') > image.indexOf('label="사진 맞춤과 디자인"')
  && image.indexOf('<WidgetSpacingControls') < image.indexOf('</InspectorDisclosure>'),
  'image crop, fit and spacing remain functional but initially collapsed');
assert(form.indexOf('<FormFieldsSection') < form.indexOf('label="디자인 조정"')
  && form.indexOf('<Field label="버튼 문구"') < form.indexOf('label="디자인 조정"'),
  'form title, questions and submit text are primary');
const outcomeStart = form.indexOf('label="제출 안내와 개인정보"');
const designStart = form.indexOf('label="디자인 조정"');
const advancedStart = form.indexOf('label="중복 접수와 외부 연동"');
assert(outcomeStart > form.indexOf('<Field label="버튼 문구"')
  && outcomeStart < designStart && designStart < advancedStart
  && form.indexOf('<FormSuccessSettings s={s} set={set} direct />', outcomeStart) < designStart
  && form.indexOf('<FormPrivacySettings s={s} set={set} direct />', outcomeStart) < designStart
  && form.indexOf('<FormSubmissionSection s={s} set={set} direct />', advancedStart) > advancedStart,
  'form outcome and privacy are one disclosure, duplicate policy and embed remain separate');
for (const file of ['FormPrivacySettings', 'FormSuccessSettings', 'FormSubmissionSection']) {
  const source = read('src/editor/blockEditors/' + file + '.jsx');
  assert(source.includes('direct = false') && source.includes('if (direct)') && source.includes('form-inline-group'),
    file + ' must provide directly editable fields without nested accordions');
}
assert(code.includes('<CodeEditorBox') && code.includes('codeDraftHint') && codeBox.includes('aria-label="HTML 코드 초안"')
  && codeBox.includes('onClick={onApply}'), 'direct code editing, draft state and apply remain visible');
assert(inspector.includes('editor-inspector-selected-copy') && inspector.includes('{primaryLabel}')
  && inspector.includes('editor-inspector-selected-context'),
  'one selected-item identity and a task-specific primary heading replace dense settings header');
assert(css.includes('.editor-inspector-kind-icon') && css.includes('.editor-inspector-selected-copy')
  && css.includes('margin: 4px 0 17px;'),
  'inspector styles are owned by existing layout stylesheet');
assert(disclosure.includes('expandedByBlock = new Map()')
  && disclosure.includes('expandedByBlock.has(persistKey)')
  && disclosure.includes('rememberExpanded(persistKey, next)')
  && disclosure.includes('event.preventDefault()')
  && disclosure.includes('<summary onClick={onActivate}>')
  && text.includes('persistKey={blockId ?')
  && image.includes('persistKey={(blockId || block?.id) ?')
  && form.includes('form-behavior'),
  'native disclosure must preserve only per-page/per-block UI expansion across lazy editor remounts');
assert(browser.includes('inspector-content-first-') && browser.includes('firstView.secondaryClosed')
  && browser.includes('optionalText.spacingVisible') && browser.includes('optionalText.colorVisible'),
  'real Chrome verifies first-view design and hidden style controls reopening');
// Parse all browser entrypoints cheaply during offline QA, before running the
// full authenticated Chrome flow (which also exercises media library paths).
for (const entry of [
  'scripts/editor-browser-regression-check.mjs',
  'scripts/editor-image-library-browser-check.mjs',
  'scripts/editor-video-library-browser-check.mjs',
  'scripts/media-library-settings-browser-check.mjs',
]) {
  execFileSync(process.execPath, ['--check', entry], { stdio: 'pipe' });
}
console.log('Content-first selected inspector design contract passed');

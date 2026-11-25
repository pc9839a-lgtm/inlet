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

const pagePresets = read('src/panels/PageDesignPresets.jsx');
const stylePanel = read('src/panels/StylePanel.jsx');
const quickDesign = read('src/editor/blockEditors/QuickDesignChoices.jsx');
const inlineEdit = read('src/preview/EditorInlineTextField.jsx');
const hero = read('src/editor/blockEditors/HeroEditor.jsx');
const links = read('src/editor/blockEditors/LinksEditor.jsx');

// 2026-11-23 explicit owner rejection supersedes design-first gate:
// beginners must edit familiar text/photo/form fields FIRST, with design
// alternatives folded and accessible below the task.
assert(quickDesign.includes('모양 ${index + 1}')
  && quickDesign.includes('aria-pressed={selected === choice.value}')
  && quickDesign.includes('<div className="editor-quick-design" role="group" aria-label={title}>')
  && !quickDesign.includes('<details')
  && text.indexOf('<QuickDesignChoices') > text.indexOf('label="본문"')
  && hero.indexOf('<QuickDesignChoices') > hero.indexOf('<HeroBasicSection')
  && image.indexOf('<QuickDesignChoices') > image.indexOf('<ImageBasicSection')
  && form.indexOf('<QuickDesignChoices') > form.indexOf('<FormBasicSection')
  && links.indexOf('<QuickDesignChoices') > links.indexOf('label="제목"'),
  'content editing must lead and the one design disclosure stays collapsed and its choices remain keyboard accessible');
assert(text.indexOf('label="제목"') < text.indexOf('label="본문"')
  && text.indexOf('label="본문"') < text.indexOf('label="디자인"'),
  'title and body precede design');
assert(text.includes('<WidgetSpacingControls s={s} set={set} />')
  && text.indexOf('<WidgetSpacingControls') < text.indexOf('</InspectorDisclosure>'),
  'text spacing lives in one optional design disclosure');
assert(!text.includes('defaultOpen'), 'text visual design must not monopolize first view');
assert(image.indexOf('<ImageBasicSection') < image.indexOf('label="사진 꾸미기"')
  && image.indexOf('<ImageCaptionSection') < image.indexOf('label="사진 꾸미기"'),
  'image replacement and caption precede appearance');
assert(image.indexOf('<ImageDisplayControls') > image.indexOf('label="사진 꾸미기"')
  && image.indexOf('<WidgetSpacingControls') < image.indexOf('</InspectorDisclosure>'),
  'image crop, fit and spacing remain functional but initially collapsed');
assert(form.indexOf('<FormFieldsSection') < form.indexOf('label="디자인"')
  && form.indexOf('<Field label="버튼 문구"') < form.indexOf('label="디자인"'),
  'form title, questions and submit text are primary');
const outcomeStart = form.indexOf('label="제출 안내와 개인정보"');
const designStart = form.indexOf('label="디자인"');
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
assert(inspector.includes('editor-inspector-selected-copy')
  && inspector.includes('<h2 tabIndex={-1} title={title}>{title}</h2>')
  && inspector.includes('{renderBlockEditor(block)}')
  && !inspector.includes('{primaryLabel}')
  && !inspector.includes('editor-inspector-selected-context'),
  'selected block must show its editable identity without a duplicate task heading');
assert(css.includes('.editor-inspector-kind-icon') && css.includes('.editor-inspector-selected-copy')
  && css.includes('.editor-inspector-section-label')
  && css.includes('.editor-inspector-panel.editor-inline-settings')
  && css.includes('padding: 12px 0 10px !important;'),
  'inline selected block must have one compact identity header before its existing editable fields');
assert(!inspector.includes('editor-inspector-jump')
  && !inspector.includes('jumpToSection')
  && inspector.includes('{renderBlockEditor(block)}')
  && form.includes('className="editor-task-section form-questions-task"')
  && form.includes('className="editor-task-section form-submit-task"')
  && browser.includes('text and body must appear before one collapsed design section'),
  'content-first workbench must not include fake content/design tabs that merely scroll to another accordion');
assert(disclosure.includes('expandedByBlock = new Map()')
  && disclosure.includes('expandedByBlock.has(persistKey)')
  && disclosure.includes('rememberExpanded(persistKey, next)')
  && disclosure.includes('event.preventDefault()')
  && disclosure.includes('<summary onClick={onActivate}>')
  && text.includes('persistKey={blockId ?')
  && image.includes('persistKey={(blockId || block?.id) ?')
  && form.includes('form-behavior'),
  'native disclosure must preserve only per-page/per-block UI expansion across lazy editor remounts');
assert(browser.includes('beginner-text-content-before-design-1672')
  && browser.includes('textTask.folded')
  && browser.includes('contentBeforeDesign')
  && browser.includes('beginner-compact-edit-673'),
  'Chrome verifies text first, optional design folded and compact edit task reachable');
assert(pagePresets.includes('function matchesLook')
  && pagePresets.includes("onPick({")
  && pagePresets.includes("bgMode: 'solid'")
  && pagePresets.includes("fontFamily: look.fontFamily")
  && stylePanel.includes('<PageDesignPresets theme={draftTheme} onPick={updateDraft} />')
  && stylePanel.includes('className="style-advanced-group style-custom-settings"')
  && stylePanel.includes('updateTheme(draftTheme)')
  && stylePanel.includes('onPreviewThemeChange?.(null)'),
  'page design cards must only stage real theme settings with explicit apply and undo');
assert(quickDesign.includes('aria-pressed={selected === choice.value}')
  && quickDesign.includes('onClick={() => onSelect(choice.value)}')
  && text.includes('<QuickDesignChoices') && image.includes('<QuickDesignChoices')
  && form.includes('<QuickDesignChoices') && hero.includes('<QuickDesignChoices')
  && links.includes('<QuickDesignChoices')
  && !quickDesign.includes('updatePage(')
  && !quickDesign.includes('editor-quick-design-sample')
  && !quickDesign.includes('editor-quick-design-index'),
  'representative widget design selections must keep the same real model callbacks behind optional disclosure');
assert(inlineEdit.includes('onClick={enabled ? begin : undefined}')
  && inlineEdit.includes('onCompositionEnd')
  && inlineEdit.includes('htmlValue !== originalRef.current')
  && inlineEdit.includes('onCommit(blockId, field, nextHtml, originalRef.current)'),
  'single click text edit preserves IME, conflict detection and original draft writes');
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

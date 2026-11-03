import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const header = await readFile('src/builder/PanelHeader.jsx', 'utf8');
const feedback = await readFile('src/runtime/pageSaveFeedback.js', 'utf8');
const localStatus = await readFile('src/runtime/saveStatusActions.js', 'utf8');
const unsavedGuard = await readFile('src/runtime/workspaceUnsavedGuard.js', 'utf8');
const saveAction = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const browserQa = await readFile('scripts/editor-browser-regression-check.mjs', 'utf8');
const app = await readFile('src/App.jsx', 'utf8');
const workspaceEffects = await readFile('src/runtime/useWorkspaceEditorEffects.js', 'utf8');

assert(header.includes('visibleEditorPublishState({') && header.includes("publishState.label === '발행됨'"), 'header must consume page-scoped publish state instead of a transient saved flag');
const { visibleEditorPublishState, visibleEditorDraftState, nextEditorMutationStatus } = await import('../src/runtime/saveStatusActions.js');
const { pageOperationIdentity } = await import('../src/runtime/pageOperationIdentity.js');
const sample = { id: 'semantics-a', projectId: 'p', ownerId: 'o', slug: 'a' };
const success = { tone: 'ok', label: '발행됨', savedPageIdentity: pageOperationIdentity(sample) };
assert(visibleEditorPublishState({ page: sample, saved: false, saveStatus: success }).label === '발행됨', 'successful publish remains visible when transient confirmation ends');
assert(visibleEditorPublishState({ page: { ...sample, id: 'semantics-b' }, saved: true, saveStatus: success }).label !== '발행됨', 'other page must not inherit publish success');
// UX-034: editor draft and public publication are orthogonal, and critical
// failures survive a pending style/code draft and later local edits.
const scenarios = [
  ['before-publication', { page: sample }, '발행 전', '편집본 준비', '게시하기'],
  ['dirty', { page: sample, saveStatus: { phase: 'dirty', tone: 'idle', label: '공개 미반영' } }, '미발행 변경', '편집본 변경됨', '게시하기'],
  ['saving-draft', { page: sample, saveStatus: { phase: 'saving', tone: 'warning', label: '임시저장 중' } }, '발행 전', '임시저장 중', '게시하기'],
  ['stored-locally', { page: sample, saveStatus: { tone: 'ok', label: '브라우저에 임시저장됨' } }, '미발행 변경', '브라우저 임시보관됨', '게시하기'],
  ['failed-local', { page: sample, saveStatus: { tone: 'error', label: '임시저장 실패' } }, '발행 전', '임시보관 실패', '게시하기'],
  ['unapplied', { page: sample, hasUnappliedDrafts: true }, '미발행 변경', '미적용 변경', '적용 후 발행'],
  ['publishing', { page: sample, saveStatus: { phase: 'publishing', tone: 'warning', label: '발행 중' } }, '발행 중', '서버 저장·발행 중', '발행 중'],
  ['published', { page: sample, saveStatus: success }, '발행됨', '편집본 발행됨', '발행됨'],
  ['failed-with-unapplied', { page: sample, saveStatus: { tone: 'error', label: '발행 실패', detail: '네트워크 오류' }, hasUnappliedDrafts: true }, '발행 실패', '미적용 변경', '다시 발행'],
  ['unverified-with-unapplied', { page: sample, saveStatus: { tone: 'warning', label: '발행됨 · 공개 반영 확인 중' }, hasUnappliedDrafts: true }, '발행됨 · 공개 반영 확인 중', '미적용 변경', '다시 발행'],
];
for (const [name, args, publishedLabel, draftLabel, actionLabel] of scenarios) {
  const pub = visibleEditorPublishState(args);
  const draft = visibleEditorDraftState(args);
  assert(pub.label === publishedLabel && draft.label === draftLabel && pub.actionLabel === actionLabel,
    'editor dual status must preserve correct phase ' + name + ': ' + JSON.stringify({ pub, draft }));
}
assert(visibleEditorDraftState({ page: sample, saveStatus: { tone: 'error', label: '임시저장 실패' } }).label === '임시보관 실패',
  'failed local backup must never be described as saved');
const untouchedError = { tone: 'error', label: '발행 실패', detail: '서버 오류' };
const unverified = { tone: 'warning', label: '발행됨 · 공개 반영 확인 필요' };
assert(nextEditorMutationStatus(untouchedError) === untouchedError && nextEditorMutationStatus(unverified) === unverified
  && nextEditorMutationStatus({ phase: 'publishing' }).phase === 'publishing'
  && nextEditorMutationStatus({ tone: 'ok', label: '발행됨' }, '2026-11-03T10:00:00.000Z').phase === 'dirty',
  'local mutations must preserve unresolved failure and verification warnings, while ordinary edits become dirty');
assert(header.includes('data-public-state={publishState.kind}') && header.includes('data-draft-state={draftState.kind}')
  && header.includes('role="status"') && header.includes('publishState.actionLabel')
  && header.includes('공개 상태:') && header.includes('편집본 상태:'),
  'header must expose independent and accessible draft/public stages without changing onSave');
assert(header.includes('자동 임시보관됩니다') && header.includes('공개 페이지에 반영됩니다'), 'publish button must explain local draft versus public effect');
assert(feedback.includes("title: local ? '브라우저에 임시저장됨' : '발행됨'"), 'save feedback must distinguish local temporary storage from server publish');
assert(feedback.includes('공개 반영 확인 중') && feedback.includes('공개 반영 확인 필요'), 'publish feedback must retain public verification states');
assert(localStatus.includes("markSaveStatus('ok', '브라우저에 임시저장됨', '')"), 'local storage success must be explicitly temporary');
assert(unsavedGuard.includes('발행하지 않은 변경사항이 있습니다.') && unsavedGuard.includes('공개 페이지에는 아직 반영되지 않았습니다.'), 'dirty navigation guard must describe unpublished edits');
assert(saveAction.includes('persistPage(nextPage, authUser') && saveAction.includes('attachPublicPageSaveVerification'), 'publish action must retain canonical server persistence and public verification');
assert(browserQa.includes('saveCount === 0'), 'browser regression must prove ordinary editing does not publish before the primary action');
assert(browserQa.includes('publicVerifyCount'), 'browser regression must still verify public effect after publish');
// F02 must be proven by Chrome state transitions, not only string presence.
assert(!workspaceEffects.includes("tab !== 'style'") && !workspaceEffects.includes('setStylePreviewTheme(null)'), 'workspace tab effects must never discard staged style');
const tabChangeScope = app.split('const changeTab = (nextTab) => {')[1]?.split('const previewUrl =')[0] || '';
assert(tabChangeScope.includes('replaceLocationTab(') && !tabChangeScope.includes('clearPendingStyle()') && !tabChangeScope.includes('confirmLeaveStyleChanges('), 'workspace tabs must preserve unapplied style; only real page exits may discard it');
assert(browserQa.includes('F02 tab-independent confirmation for an unapplied style') && browserQa.includes('F02 staged accent survives workspace switch'), 'F02 live Chrome checks must cover both cross-tab confirmation and restored style');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-draft-publish-semantics',
  localDraft: true,
  explicitPublish: true,
  publicVerificationPreserved: true,
  saveApiChanged: false,
}, null, 2));

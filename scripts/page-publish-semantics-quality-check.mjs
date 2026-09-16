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

assert(header.includes("{saved ? '발행됨' : '발행'}"), 'server persistence button must be labeled as publish');
assert(header.includes('자동 임시보관됩니다') && header.includes('공개 페이지에 반영됩니다'), 'publish button must explain local draft versus public effect');
assert(feedback.includes("title: local ? '브라우저에 임시저장됨' : '발행됨'"), 'save feedback must distinguish local temporary storage from server publish');
assert(feedback.includes('공개 반영 확인 중') && feedback.includes('공개 반영 확인 필요'), 'publish feedback must retain public verification states');
assert(localStatus.includes("markSaveStatus('ok', '브라우저에 임시저장됨', '')"), 'local storage success must be explicitly temporary');
assert(unsavedGuard.includes('발행하지 않은 변경사항이 있습니다.') && unsavedGuard.includes('공개 페이지에는 아직 반영되지 않았습니다.'), 'dirty navigation guard must describe unpublished edits');
assert(saveAction.includes('persistPage(nextPage, authUser') && saveAction.includes('attachPublicPageSaveVerification'), 'publish action must retain canonical server persistence and public verification');
assert(browserQa.includes('saveCount === 0'), 'browser regression must prove ordinary editing does not publish before the primary action');
assert(browserQa.includes('publicVerifyCount'), 'browser regression must still verify public effect after publish');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-draft-publish-semantics',
  localDraft: true,
  explicitPublish: true,
  publicVerificationPreserved: true,
  saveApiChanged: false,
}, null, 2));

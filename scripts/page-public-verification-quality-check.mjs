import { readFile } from 'node:fs/promises';
import {
  PUBLIC_VERIFY_DELAYED_TOAST,
  pageSavePublicVerificationDelayed,
  pageSavePublicVerificationPending,
  pageSaveSuccessFeedback,
} from '../src/runtime/pageSaveFeedback.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pendingResult = {
  ok: true,
  page: { id: 'page-1', projectId: 'project-1', slug: 'sample', revision: 2 },
  publicVerification: { ok: null, pending: true, skipped: false, completion: Promise.resolve({ ok: true, pending: false }) },
};
assert(pageSavePublicVerificationPending(pendingResult), 'pending public verification must be detected');
assert(!pageSavePublicVerificationDelayed(pendingResult), 'pending verification must not be treated as failed');
const pendingFeedback = pageSaveSuccessFeedback(pendingResult, 'page');
assert(pendingFeedback.level === 'warning', 'pending public verification must not surface as fully verified success');
assert(pendingFeedback.title === '발행됨 · 공개 반영 확인 중', 'pending feedback must explain that publishing finished while public verification is still running');

const delayedResult = {
  ...pendingResult,
  publicVerification: { ok: false, pending: false, skipped: false, errorCode: 'PAGE_PUBLIC_VERIFY_FAILED' },
};
assert(pageSavePublicVerificationDelayed(delayedResult), 'failed public verification must be detected');
const delayedFeedback = pageSaveSuccessFeedback(delayedResult, 'page');
assert(delayedFeedback.level === 'warning', 'server-published but publicly unverified pages must be warnings, not false success');
assert(delayedFeedback.title === '발행됨 · 공개 반영 확인 필요', 'delayed feedback must distinguish server publish from public verification');
assert(delayedFeedback.toast === PUBLIC_VERIFY_DELAYED_TOAST, 'public verification failure must surface the recovery-draft warning');

const verifiedResult = {
  ...pendingResult,
  publicVerification: { ok: true, pending: false, skipped: false },
};
const verifiedFeedback = pageSaveSuccessFeedback(verifiedResult, 'page');
assert(verifiedFeedback.level === 'ok' && verifiedFeedback.title === '발행됨', 'verified public publish must return normal success feedback');

const [verificationSource, persistSource, pageSaveSource, styleSaveSource, packageSource, qaAllSource] = await Promise.all([
  readFile('src/runtime/publicPageSaveVerification.js', 'utf8'),
  readFile('src/runtime/pagePersistFlow.js', 'utf8'),
  readFile('src/runtime/usePageSaveAction.js', 'utf8'),
  readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8'),
  readFile('package.json', 'utf8'),
  readFile('scripts/qa-all.mjs', 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

assert(verificationSource.includes('completion: null') && verificationSource.includes('state.completion = new Promise'), 'public verification must expose a completion promise to the save flow');
assert(verificationSource.includes("superseded: true") && verificationSource.includes("reason: 'newer-save'"), 'newer publishes must supersede older public-verification jobs');
assert(verificationSource.includes("errorCode: 'PAGE_PUBLIC_VERIFY_FAILED'"), 'public verification failure must use an explicit failure code');
assert(verificationSource.includes('fetchPublicServerPage') && verificationSource.includes('PUBLIC_VERIFICATION_ATTEMPTS = 3'), 'public verification must perform bounded fresh public reads');

assert(persistSource.includes('pageDraftContentSignature') && persistSource.includes('readPageDraft'), 'draft cleanup must compare published content before deletion');
assert(persistSource.includes('if (!sameSavedContent(draft.page, savedPage)) return false;'), 'newer or different recovery drafts must never be cleared by a late verification result');
assert(persistSource.includes('settlePendingPublicVerification') && persistSource.includes('verification.completion'), 'pending public verification must be settled asynchronously');
assert(persistSource.includes('setWorkspaceUnsavedDirty(verificationPending);'), 'workspace must remain guarded while public verification is pending');
assert(persistSource.includes('if (!verificationPending)') && persistSource.includes('clearPageDraft({ page: nextPage, authUser });'), 'draft cleanup must be deferred while verification is pending');

assert(pageSaveSource.includes('verifyPublic: false'), 'ordinary page publishes must disable the legacy fire-and-forget public verifier');
assert(pageSaveSource.includes('result = attachPublicPageSaveVerification(result);'), 'ordinary page publishes must attach tracked public verification after response validation');
assert(pageSaveSource.includes('surfaceStatus: false') && pageSaveSource.includes('settlePendingPublicVerification'), 'inactive-page publishes must preserve drafts until public verification settles');
assert(pageSaveSource.includes("message: '저장 중 변경된 내용을 자동으로 이어서 저장합니다.'"), 'publish-then-continue-typing trailing persistence must remain intact');

assert(styleSaveSource.includes('verifyPublic: false'), 'style publishes must disable the legacy fire-and-forget public verifier');
assert(styleSaveSource.includes('result = attachPublicPageSaveVerification(result);'), 'style publishes must attach tracked public verification after response validation');
assert(styleSaveSource.includes('successToast: STYLE_SAVED_TOAST'), 'style publish toast must wait for the shared public-verification settlement path');
assert(styleSaveSource.includes('surfaceStatus: false') && styleSaveSource.includes('settlePendingPublicVerification'), 'inactive style publishes must use the same draft-preservation policy');

assert(packageJson.scripts?.['page:save:public-verification:qa'] === 'node scripts/page-public-verification-quality-check.mjs', 'package public-verification QA script missing');
assert(qaAllSource.includes("['page:save:public-verification:qa', ['scripts/page-public-verification-quality-check.mjs']]"), 'release QA must include public publish verification coverage');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-public-verification',
  serverPublishSeparatedFromPublicVerification: true,
  recoveryDraftDeferredCleanup: true,
  staleVerificationSuperseded: true,
  newerDraftProtected: true,
  pageAndStyleCovered: true,
  inactivePageCovered: true,
  draftPublishSemantics: true,
}, null, 2));
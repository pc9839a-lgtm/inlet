import { readFile } from 'node:fs/promises';
import { nextTrailingSaveRequest, resumeExplicitSaveForActivePage } from '../src/runtime/saveQueuePolicy.js';
import { pageOperationIdentity } from '../src/runtime/pageOperationIdentity.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const failed = nextTrailingSaveRequest({
  result: { ok: false, reason: 'network-error' },
  queued: true,
  queuedRequest: { title: 'queued' },
  automaticRequest: { title: 'automatic' },
});
assert(!failed.continue, `failed saves must stop the queue: ${JSON.stringify(failed)}`);

const inactive = nextTrailingSaveRequest({
  result: { ok: true, reason: 'inactive-page', pendingChanges: true },
  queued: true,
  queuedRequest: { title: 'queued' },
  automaticRequest: { title: 'automatic' },
});
assert(!inactive.continue, `inactive page saves must stop the queue: ${JSON.stringify(inactive)}`);

const pageA = { id: 'page-A', slug: 'old-a', ownerId: 'owner', projectId: 'project' };
const pageB = { id: 'page-B', slug: 'new-b', ownerId: 'owner', projectId: 'project', title: 'B 저장 요청' };
const pageC = { id: 'page-C', slug: 'page-c', ownerId: 'owner', projectId: 'project' };
const inactiveA = { ok: true, reason: 'inactive-page' };
const resumeB = resumeExplicitSaveForActivePage({
  result: inactiveA,
  queuedTargetIdentity: pageOperationIdentity(pageB),
  activeTargetIdentity: pageOperationIdentity(pageB),
  queuedRequest: pageB,
});
assert(resumeB === pageB, 'page B explicitly saved during A save must still be processed after A finishes');
const failedA = resumeExplicitSaveForActivePage({
  result: { ok: false, reason: 'inactive-page' },
  queuedTargetIdentity: pageOperationIdentity(pageB),
  activeTargetIdentity: pageOperationIdentity(pageB),
  queuedRequest: pageB,
});
assert(failedA === pageB, 'failure on inactive page A must not discard B explicit save');
for (const [reason, queuedPage, activePage] of [
  ['outdated A click', pageA, pageB],
  ['B then C switch', pageB, pageC],
]) {
  assert(resumeExplicitSaveForActivePage({
    result: inactiveA,
    queuedTargetIdentity: pageOperationIdentity(queuedPage),
    activeTargetIdentity: pageOperationIdentity(activePage),
    queuedRequest: queuedPage,
  }) === null, `never save an outdated page after switching: ${reason}`);
}
assert(resumeExplicitSaveForActivePage({
  result: { ok: false, reason: 'network-error' },
  queuedTargetIdentity: pageOperationIdentity(pageB),
  activeTargetIdentity: pageOperationIdentity(pageB),
  queuedRequest: pageB,
}) === null, 'regular save failures must not trigger unintended extra writes');
assert(resumeExplicitSaveForActivePage({
  result: inactiveA,
  queuedTargetIdentity: pageOperationIdentity(pageB),
  activeTargetIdentity: pageOperationIdentity(pageB),
}) === null, 'a page switch without a queued explicit save must never auto-publish');


const explicit = nextTrailingSaveRequest({
  result: { ok: true, pendingChanges: true },
  queued: true,
  queuedRequest: { title: 'latest explicit request' },
  automaticRequest: { title: 'automatic request' },
});
assert(explicit.continue && explicit.reason === 'explicit-queued-save', `explicit queued saves must run first: ${JSON.stringify(explicit)}`);
assert(explicit.request?.title === 'latest explicit request', 'explicit queued request must not be replaced by the automatic request');

const automatic = nextTrailingSaveRequest({
  result: { ok: true, pendingChanges: true },
  automaticRequest: { title: 'rebased latest edit' },
});
assert(automatic.continue && automatic.reason === 'changes-during-save', `changes made during save must trigger a trailing save: ${JSON.stringify(automatic)}`);
assert(automatic.request?.title === 'rebased latest edit', 'automatic trailing save must use the rebased latest edit');

const stable = nextTrailingSaveRequest({ result: { ok: true, pendingChanges: false } });
assert(!stable.continue && stable.reason === 'stable', `stable saves must drain the queue: ${JSON.stringify(stable)}`);

const pageSaveSource = await readFile('src/runtime/usePageSaveAction.js', 'utf8');
const styleSaveSource = await readFile('src/runtime/usePersistStyleSaveAction.js', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

assert(pageSaveSource.includes('const queuedSaveRequestRef = useRef(null);'), 'page saves must keep a trailing request ref');
assert(pageSaveSource.includes('targetIdentity: pageOperationIdentity(queuedPage)'), 'queued clicks must capture the target page identity at click time');
assert(pageSaveSource.includes('resumeExplicitSaveForActivePage({') && pageSaveSource.includes('if (resumedRequest)'), 'the in-flight queue must drain an explicit active-page save even after an old page becomes inactive');

assert(pageSaveSource.includes('while (true)') && pageSaveSource.includes('finalResult = await runSaveCycle(request);'), 'page saves must drain sequentially instead of issuing concurrent writes');
assert(pageSaveSource.includes("markSaveStatus('warning', '저장 대기'"), 'a second save click during an active save must surface queued state');
assert(pageSaveSource.includes('queued.hasOverride ? queued.pageOverride : (latestPageRef.current || finalResult?.page || null)'), 'ordinary queued saves must resolve the latest page at drain time instead of capturing a stale snapshot');
assert(pageSaveSource.includes('automaticRequest = finalResult?.pendingChanges') && pageSaveSource.includes("reason: 'inactive-page'"), 'page save queue must auto-follow pending edits while retaining inactive-page isolation');
assert(pageSaveSource.includes("message: '저장 중 변경된 내용을 자동으로 이어서 저장합니다.'"), 'page save-race feedback must explain automatic trailing persistence');
assert(pageSaveSource.includes('if (saveInFlightRef.current === task) saveInFlightRef.current = null;') && pageSaveSource.includes('queuedSaveRequestRef.current = null;'), 'page save queue must clear in-flight and queued state after completion or failure');

assert(styleSaveSource.includes('const queuedStyleSaveRef = useRef(false);'), 'style saves must keep a trailing request flag');
assert(styleSaveSource.includes('const previewThemeAtSave = latestStylePreviewThemeRef.current;') && styleSaveSource.includes('const previewBlocksAtSave = latestStylePreviewBlocksRef.current;'), 'each style save cycle must snapshot the latest preview at cycle start');
assert(styleSaveSource.includes('while (true)') && styleSaveSource.includes('finalResult = await runStyleSaveCycle();'), 'style saves must drain sequentially instead of issuing concurrent writes');
assert(styleSaveSource.includes('automaticRequest: finalResult?.pendingChanges ? true : null'), 'style changes made during save must trigger an automatic trailing style save');
assert(styleSaveSource.includes("message: '저장 중 변경된 스타일을 자동으로 이어서 저장합니다.'"), 'style save-race feedback must explain automatic trailing persistence');
assert(styleSaveSource.includes('if (styleSaveInFlightRef.current === task) styleSaveInFlightRef.current = null;') && styleSaveSource.includes('queuedStyleSaveRef.current = false;'), 'style save queue must clear in-flight and queued state after completion or failure');

assert(packageJson.scripts?.['page:save:queue:qa'] === 'node scripts/page-save-queue-quality-check.mjs', 'package page:save:queue:qa script missing');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-save-queue',
  serializedWrites: true,
  explicitTrailingSave: true,
  automaticTrailingSave: true,
  latestAtDrainTime: true,
  pageSwitchStopsQueue: true,
  explicitNewPageClickSurvivesOldPageSave: true,
  failureStopsQueue: true,
  styleQueueCovered: true,
}, null, 2));

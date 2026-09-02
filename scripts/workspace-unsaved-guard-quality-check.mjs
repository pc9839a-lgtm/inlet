import { readFile } from 'node:fs/promises';
import {
  allowWorkspaceNextUnload,
  confirmWorkspaceLeaveSync,
  discardWorkspaceUnsavedState,
  resetWorkspaceUnsavedGuardForTests,
  setWorkspaceRecoveryFlusher,
  setWorkspaceUnsavedDirty,
  shouldBlockWorkspaceBeforeUnload,
  workspaceHasUnsavedChanges,
} from '../src/runtime/workspaceUnsavedGuard.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const originalWindow = globalThis.window;
let confirms = [];
let alerts = [];
let confirmAnswer = true;
globalThis.window = {
  confirm(message) {
    confirms.push(message);
    return confirmAnswer;
  },
  alert(message) {
    alerts.push(message);
  },
};

try {
  resetWorkspaceUnsavedGuardForTests();
  assert(confirmWorkspaceLeaveSync() === true, 'clean workspace must leave without prompting');
  assert(confirms.length === 0, 'clean workspace must not show a confirmation');

  let flushCount = 0;
  setWorkspaceRecoveryFlusher(() => {
    flushCount += 1;
    return true;
  });
  setWorkspaceUnsavedDirty(true);
  confirmAnswer = false;
  assert(confirmWorkspaceLeaveSync({ message: 'leave?' }) === false, 'cancel must keep the user in the workspace');
  assert(flushCount === 1, 'recovery draft must flush before asking to leave');
  assert(workspaceHasUnsavedChanges() === true, 'cancel must preserve dirty state');

  confirmAnswer = true;
  assert(confirmWorkspaceLeaveSync({ message: 'leave?' }) === true, 'confirm must allow an explicit leave');
  assert(flushCount === 2, 'confirmed leave must still flush recovery first');

  allowWorkspaceNextUnload();
  assert(shouldBlockWorkspaceBeforeUnload() === false, 'an explicitly confirmed navigation must not show a duplicate native unload prompt');
  assert(shouldBlockWorkspaceBeforeUnload() === true, 'unload allowance must be single-use while edits remain dirty');

  resetWorkspaceUnsavedGuardForTests();
  setWorkspaceUnsavedDirty(true);
  setWorkspaceRecoveryFlusher(() => false);
  confirms = [];
  alerts = [];
  assert(confirmWorkspaceLeaveSync({ message: 'unsafe leave?' }) === false, 'leave must be blocked when recovery storage fails');
  assert(confirms.length === 0, 'storage failure must block before offering destructive leave confirmation');
  assert(alerts.length === 1 && /임시 보관/.test(alerts[0]), 'storage failure must explain that the current screen should remain open');

  discardWorkspaceUnsavedState();
  assert(workspaceHasUnsavedChanges() === false, 'explicit discard after deletion must clear dirty state');
  assert(shouldBlockWorkspaceBeforeUnload() === false, 'discarded state must not block unload');

  const localPersistence = await readFile('src/runtime/useLocalWorkspacePersistence.js', 'utf8');
  const authActions = await readFile('src/runtime/useAuthAccountActions.js', 'utf8');
  const shellActions = await readFile('src/runtime/useWorkspaceShellActions.js', 'utf8');
  const dashboard = await readFile('src/screens/DashboardScreen.jsx', 'utf8');

  assert(localPersistence.includes('setWorkspaceUnsavedDirty(true)') && localPersistence.includes('shouldBlockWorkspaceBeforeUnload()'), 'local persistence must own dirty detection and native unload blocking');
  assert(localPersistence.includes("window.addEventListener('beforeunload', handleBeforeUnload)"), 'browser close/reload must use the unified unsaved guard');
  assert(authActions.includes('confirmWorkspaceLeaveSync') && authActions.includes('allowUnload: true'), 'logout must guard unsaved edits before replacing the page');
  assert(shellActions.includes('confirmWorkspaceLeaveSync') && shellActions.includes('대시보드로 이동'), 'workspace-to-dashboard navigation must guard unsaved edits');
  assert(dashboard.includes('const dirtyCurrent = deletingCurrent && workspaceHasUnsavedChanges()') && dashboard.includes('clearPageDraft({ page: item, authUser: user, allSources: true })'), 'current-page deletion must combine unsaved confirmation with draft cleanup');
  assert(dashboard.includes('allowWorkspaceNextUnload()') && dashboard.includes('window.location.assign'), 'explicit page switches must avoid duplicate native unload prompts after confirmation');

  console.log(JSON.stringify({
    ok: true,
    checks: 15,
    unifiedUnsavedGuard: true,
    recoveryBeforeLeave: true,
    browserUnloadGuard: true,
    deletionDraftCleanup: true,
  }, null, 2));
} finally {
  resetWorkspaceUnsavedGuardForTests();
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}

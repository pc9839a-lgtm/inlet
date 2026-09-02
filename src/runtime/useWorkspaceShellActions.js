import { DASHBOARD_KEY, START_MODE_KEY } from '../config/storageKeys.js';
import { confirmWorkspaceLeaveSync } from './workspaceUnsavedGuard.js';

export function useWorkspaceShellActions({
  page,
  allowedTabs,
  canUseBuilder,
  canManageAdmin,
  startMode,
  confirmLeaveStyleChanges,
  clearPendingStyle,
  saveLocalJson,
  setStartMode,
  setTab,
  setOpenId,
  setAddOpen,
  setWorkspaceOpen,
}) {
  const chooseStartMode = (mode) => {
    if (!canManageAdmin) return;
    if (mode === 'template') {
      setStartMode('template');
      setTab('edit');
      return;
    }
    saveLocalJson(START_MODE_KEY, mode, '시작 선택', { quietSuccess: true });
    setStartMode(mode);
    if (mode === 'ai') {
      setTab('edit');
      return;
    }
    setTab('edit');
  };

  const reopenStartChoice = () => {
    if (!canManageAdmin) return;
    const run = () => {
      clearPendingStyle();
      localStorage.removeItem(START_MODE_KEY);
      setStartMode('');
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };

  const selectPreviewBlock = (id) => {
    if (!canUseBuilder) return;
    if (!id) return;
    const target = page.blocks.find((block) => block.id === id);
    if (['topnav', 'bottombar', 'footer'].includes(target?.type)) {
      setOpenId('');
      return;
    }
    const run = () => {
      clearPendingStyle();
      setTab('edit');
      setOpenId(id);
      requestAnimationFrame(() => {
        document.getElementById(`editor-block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };

  const openWorkspace = (fallbackMode = 'manual') => {
    if (typeof history !== 'undefined') history.replaceState(null, '', '/app');
    setOpenId('');
    setAddOpen(false);
    if (!canUseBuilder) {
      setTab(allowedTabs[0] || 'inbox');
      saveLocalJson(DASHBOARD_KEY, { open: true }, '작업공간 상태', { quietSuccess: true });
      setWorkspaceOpen(true);
      return;
    }
    if (canManageAdmin && !startMode) {
      saveLocalJson(START_MODE_KEY, fallbackMode, '시작 선택', { quietSuccess: true });
      setStartMode(fallbackMode);
    }
    saveLocalJson(DASHBOARD_KEY, { open: true }, '작업공간 상태', { quietSuccess: true });
    setWorkspaceOpen(true);
  };

  const closeWorkspace = () => {
    const run = () => {
      if (!confirmWorkspaceLeaveSync({
        message: '저장하지 않은 변경사항이 있습니다. 임시 편집본은 브라우저에 보관됩니다. 저장하지 않고 대시보드로 이동할까요?',
      })) return;
      if (typeof history !== 'undefined') history.replaceState(null, '', '/dashboard');
      clearPendingStyle();
      saveLocalJson(DASHBOARD_KEY, { open: false }, '작업공간 상태', { quietSuccess: true });
      setWorkspaceOpen(false);
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };

  return {
    chooseStartMode,
    reopenStartChoice,
    selectPreviewBlock,
    openWorkspace,
    closeWorkspace,
  };
}
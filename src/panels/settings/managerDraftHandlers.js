import { confirmAction, notify } from '../../lib/uiFeedback.js';
import { managerLabel } from './managerSettingsModel.js';
import {
  applyManagerPermissionMode,
  createNewManager,
  normalizeManagerDrafts,
  updateManagerAt,
} from './managerSettingsState.js';

export function createManagerDraftHandlers({
  editSection,
  lockSection,
  managerDraft,
  managers,
  ownership,
  page,
  setExpandedManagerId,
  setExpandedManagerMenuId,
  setManagerDraft,
  updatePage,
}) {
  const updateOwnership = (patch) => {
    updatePage({
      ownership: {
        ...ownership,
        ...(page.ownership || {}),
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const updateManagerDrafts = (nextManagers) => {
    setManagerDraft(normalizeManagerDrafts(nextManagers));
  };

  const updateManager = (index, patch) => {
    updateManagerDrafts(updateManagerAt(managerDraft, index, patch));
  };

  const setManagerPermissionMode = (index, tab, mode) => {
    updateManagerDrafts(managerDraft.map((manager, currentIndex) => (
      currentIndex === index ? applyManagerPermissionMode(manager, tab, mode) : manager
    )));
  };

  const setManagerPreset = (index, preset) => {
    updateManager(index, { access: preset.access });
    setExpandedManagerMenuId('');
  };

  const saveManagers = () => {
    updateOwnership({ managers: normalizeManagerDrafts(managerDraft) });
    lockSection('managers');
    notify('매니저 권한을 저장했습니다.', 'success');
  };

  const editManagers = () => {
    setManagerDraft(normalizeManagerDrafts(managers.length ? managers : managerDraft));
    editSection('managers');
  };

  const addManager = () => {
    const manager = createNewManager();
    updateManagerDrafts([...managerDraft, manager]);
    editSection('managers');
    setExpandedManagerId(manager.id);
    notify('매니저 입력 칸을 추가했습니다.', 'success');
  };

  const disableManager = (index) => {
    updateManager(index, { status: 'disabled' });
  };

  const removeManager = async (index) => {
    const manager = managerDraft[index];
    const ok = await confirmAction({
      title: '매니저 삭제',
      message: `${managerLabel(manager)} 매니저 권한을 삭제할까요? 삭제하면 해당 매니저는 더 이상 이 페이지를 관리할 수 없습니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    });
    if (!ok) return;
    updateManagerDrafts(managerDraft.filter((_, currentIndex) => currentIndex !== index));
  };

  return {
    addManager,
    disableManager,
    editManagers,
    removeManager,
    saveManagers,
    setManagerPermissionMode,
    setManagerPreset,
    updateManager,
    updateOwnership,
  };
}

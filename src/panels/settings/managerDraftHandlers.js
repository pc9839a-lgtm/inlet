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
    notify('留ㅻ땲? 沅뚰븳????ν뻽?듬땲??', 'success');
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
    notify('留ㅻ땲? ?낅젰 移몄쓣 異붽??덉뒿?덈떎.', 'success');
  };

  const disableManager = (index) => {
    updateManager(index, { status: 'disabled' });
  };

  const removeManager = async (index) => {
    const manager = managerDraft[index];
    const ok = await confirmAction({
      title: '留ㅻ땲? ??젣',
      message: `${managerLabel(manager)}???섏씠吏 ?묎렐 沅뚰븳???쒓굅?⑸땲?? ??ν븯硫??쒕쾭 ?묎렐??李⑤떒?⑸땲??`,
      confirmLabel: '??젣',
      cancelLabel: '痍⑥냼',
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

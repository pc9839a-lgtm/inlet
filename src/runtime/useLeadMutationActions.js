import { isLeadConflictError, leadConflictMessage } from '../builder/conflictUtils.js';
import { deleteServerLead, updateServerLead } from '../lib/leadRepository.js';
import { isServerLeadMode } from '../config/runtimeConfig.js';
import { normalizeLeadItem, } from '../lib/leadModel.js';
import { uid } from '../lib/pageModel.js';

export function useLeadMutationActions({
  authUser,
  blockWrite,
  leadConflict,
  leads,
  page,
  refreshServerLeads,
  requestConfirm,
  setLeadConflict,
  setLeadPageMeta,
  setLeads,
  showToast,
}) {
  const updateLead = (id, patch) => {
    if (blockWrite('inbox')) return;
    const previous = leads.find((lead) => lead.id === id) || null;
    const expectedUpdatedAt = previous?.updatedAt || previous?.savedAt || previous?.createdAt || '';
    const historyEntry = previous && (
      (Object.prototype.hasOwnProperty.call(patch, 'status') && patch.status !== previous.status)
      || (Object.prototype.hasOwnProperty.call(patch, 'memo') && patch.memo !== previous.memo)
    )
      ? {
        id: uid(),
        type: Object.prototype.hasOwnProperty.call(patch, 'status') ? 'status' : 'memo',
        from: Object.prototype.hasOwnProperty.call(patch, 'status') ? previous.status || '' : previous.memo || '',
        to: Object.prototype.hasOwnProperty.call(patch, 'status') ? patch.status || '' : patch.memo || '',
        at: new Date().toISOString(),
      }
      : null;
    const patchWithHistory = historyEntry
      ? { ...patch, history: [...(previous?.history || []), historyEntry].slice(-30) }
      : patch;
    setLeads((list) => list.map((lead) => {
      if (lead.id !== id) return lead;
      return { ...lead, ...patchWithHistory };
    }));
    updateServerLead(id, { ...patchWithHistory, __expectedUpdatedAt: expectedUpdatedAt }, page, authUser).catch((error) => {
      console.warn('Server lead sync failed:', error);
      if (previous) {
        setLeads((list) => list.map((lead) => lead.id === id ? previous : lead));
        const conflict = isLeadConflictError(error);
        if (conflict && isServerLeadMode()) {
          setLeadConflict({
            id,
            action: 'update',
            patch: patchWithHistory,
            previous,
            latest: error?.details?.latest || null,
            message: leadConflictMessage('저장'),
            createdAt: Date.now(),
          });
          return;
        }
        showToast(conflict ? leadConflictMessage('저장') : `접수 데이터 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    });
  };

  const performDeleteLead = (id) => {
    if (blockWrite('inbox')) return;
    const removed = leads.find((lead) => lead.id === id) || null;
    setLeads((list) => list.filter((lead) => lead.id !== id));
    if (removed) setLeadPageMeta((meta) => ({ ...meta, total: Math.max(0, Number(meta.total || 0) - 1) }));
    deleteServerLead(id, page, authUser).catch((error) => {
      console.warn('Server lead delete failed:', error);
      if (removed) {
        setLeads((list) => [removed, ...list]);
        setLeadPageMeta((meta) => ({ ...meta, total: Number(meta.total || 0) + 1 }));
        if (isLeadConflictError(error) && isServerLeadMode()) {
          setLeadConflict({
            id,
            action: 'delete',
            previous: removed,
            latest: error?.details?.latest || null,
            message: leadConflictMessage('삭제'),
            createdAt: Date.now(),
          });
          return;
        }
        showToast(`접수 데이터 삭제에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    });
  };

  const deleteLead = (id) => {
    requestConfirm({
      title: '접수 데이터를 삭제할까요?',
      message: '삭제 후에는 이 화면에서 바로 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      danger: true,
      onConfirm: () => performDeleteLead(id),
    });
  };

  const reloadLeadConflict = async () => {
    await refreshServerLeads({ quiet: false });
    setLeadConflict(null);
  };

  const retryLeadConflict = async () => {
    const conflict = leadConflict;
    if (!conflict?.id) return;
    if (conflict.action === 'delete') {
      setLeadConflict(null);
      performDeleteLead(conflict.id);
      return;
    }

    const snapshot = await refreshServerLeads({ quiet: true });
    const latest = (snapshot?.leads || []).find((lead) => String(lead.id) === String(conflict.id));
    if (!latest) {
      showToast('최신 목록에서 해당 접수 데이터를 찾지 못했습니다. 목록을 새로고침하세요.', 'error');
      return;
    }

    const expectedUpdatedAt = latest.updatedAt || latest.savedAt || latest.createdAt || '';
    const nextLead = normalizeLeadItem({ ...latest, ...(conflict.patch || {}) });
    setLeads((list) => list.map((lead) => String(lead.id) === String(conflict.id) ? nextLead : lead));
    try {
      const saved = await updateServerLead(conflict.id, { ...(conflict.patch || {}), __expectedUpdatedAt: expectedUpdatedAt }, page, authUser);
      if (saved) {
        setLeads((list) => list.map((lead) => String(lead.id) === String(conflict.id) ? normalizeLeadItem(saved) : lead));
      }
      setLeadConflict(null);
      showToast('내 변경을 최신 접수 데이터에 다시 적용했습니다.', 'success');
    } catch (error) {
      console.warn('Server lead conflict retry failed:', error);
      if (isLeadConflictError(error)) {
        setLeadConflict({
          ...conflict,
          latest: error?.details?.latest || null,
          message: leadConflictMessage('저장'),
          createdAt: Date.now(),
        });
        showToast('다시 충돌했습니다. 최신 목록을 확인한 뒤 다시 시도하세요.', 'error');
      } else {
        setLeads((list) => list.map((lead) => String(lead.id) === String(conflict.id) ? latest : lead));
        showToast(`접수 데이터 재시도에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    }
  };

  return { deleteLead, reloadLeadConflict, retryLeadConflict, updateLead };
}
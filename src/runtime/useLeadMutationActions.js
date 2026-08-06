import { isLeadConflictError, leadConflictMessage } from '../builder/conflictUtils.js';
import { deleteServerLead, updateServerLead } from '../lib/leadRepository.js';
import { isServerLeadMode } from '../config/runtimeConfig.js';
import { normalizeLeadItem } from '../lib/leadModel.js';
import { uid } from '../lib/pageModel.js';

function leadVersion(lead = {}) {
  return lead.updatedAt || lead.savedAt || lead.createdAt || '';
}

function comparablePatchEntries(patch = {}) {
  return Object.entries(patch).filter(([key]) => !['history', '__expectedUpdatedAt', 'expectedUpdatedAt'].includes(key));
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function patchAlreadyApplied(latest = {}, patch = {}) {
  const entries = comparablePatchEntries(patch);
  return entries.length > 0 && entries.every(([key, value]) => sameValue(latest?.[key], value));
}

function mergePatchHistory(latest = {}, patch = {}) {
  if (!Array.isArray(patch.history)) return { ...patch };
  const merged = [...(Array.isArray(latest.history) ? latest.history : [])];
  patch.history.forEach((entry) => {
    const entryId = String(entry?.id || '');
    if (entryId && merged.some((item) => String(item?.id || '') === entryId)) return;
    merged.push(entry);
  });
  return { ...patch, history: merged.slice(-30) };
}

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
  const saveAgainstLatest = async (id, patch) => {
    const snapshot = await refreshServerLeads({ quiet: true });
    const latest = (snapshot?.leads || []).find((lead) => String(lead.id) === String(id));
    if (!latest) throw new Error('최신 목록에서 해당 접수 데이터를 찾지 못했습니다.');

    if (patchAlreadyApplied(latest, patch)) {
      setLeads((list) => list.map((lead) => String(lead.id) === String(id) ? normalizeLeadItem(latest) : lead));
      setLeadConflict(null);
      return latest;
    }

    const rebasedPatch = mergePatchHistory(latest, patch);
    const optimistic = normalizeLeadItem({ ...latest, ...rebasedPatch });
    setLeads((list) => list.map((lead) => String(lead.id) === String(id) ? optimistic : lead));

    try {
      const saved = await updateServerLead(id, {
        ...rebasedPatch,
        __expectedUpdatedAt: leadVersion(latest),
      }, page, authUser);
      const resolved = saved ? normalizeLeadItem(saved) : optimistic;
      setLeads((list) => list.map((lead) => String(lead.id) === String(id) ? resolved : lead));
      setLeadConflict(null);
      return resolved;
    } catch (error) {
      setLeads((list) => list.map((lead) => String(lead.id) === String(id) ? normalizeLeadItem(latest) : lead));
      throw error;
    }
  };

  const updateLead = (id, patch) => {
    if (blockWrite('inbox')) return;
    const previous = leads.find((lead) => lead.id === id) || null;
    const expectedUpdatedAt = leadVersion(previous);
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

    updateServerLead(id, { ...patchWithHistory, __expectedUpdatedAt: expectedUpdatedAt }, page, authUser).catch(async (error) => {
      console.warn('Server lead sync failed:', error);
      if (!previous) return;

      setLeads((list) => list.map((lead) => lead.id === id ? previous : lead));
      const conflict = isLeadConflictError(error);
      if (conflict && isServerLeadMode()) {
        try {
          await saveAgainstLatest(id, patchWithHistory);
          return;
        } catch (retryError) {
          console.warn('Automatic lead conflict recovery failed:', retryError);
          if (isLeadConflictError(retryError)) {
            setLeadConflict({
              id,
              action: 'update',
              patch: patchWithHistory,
              previous,
              latest: retryError?.details?.latest || null,
              message: '최신 데이터 반영이 지연되고 있습니다. 다시 시도해주세요.',
              createdAt: Date.now(),
            });
            return;
          }
          showToast(`접수 데이터 저장에 실패했습니다. ${String(retryError?.message || retryError)}`, 'error');
          return;
        }
      }
      showToast(`접수 데이터 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
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

    try {
      await saveAgainstLatest(conflict.id, conflict.patch || {});
      setLeadConflict(null);
      showToast('최신 접수 데이터에 변경사항을 반영했습니다.', 'success');
    } catch (error) {
      console.warn('Server lead conflict retry failed:', error);
      if (isLeadConflictError(error)) {
        setLeadConflict({
          ...conflict,
          latest: error?.details?.latest || null,
          message: '최신 데이터 반영이 지연되고 있습니다. 다시 시도해주세요.',
          createdAt: Date.now(),
        });
        showToast('최신 목록을 확인한 뒤 다시 시도해주세요.', 'error');
      } else {
        showToast(`접수 데이터 재시도에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    }
  };

  return { deleteLead, reloadLeadConflict, retryLeadConflict, updateLead };
}

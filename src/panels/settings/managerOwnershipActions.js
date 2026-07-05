import { createServerOwnershipTransfer } from '../../lib/managerInvites.js';
import { confirmAction, notify } from '../../lib/uiFeedback.js';
import { managerLabel } from './managerSettingsModel.js';
import { normalizeManagerDrafts, ownershipTransferPatch } from './managerSettingsState.js';

function selectedTransferManager(eligibleTransferManagers, transferManagerId) {
  return eligibleTransferManagers.find((manager) => manager.id === transferManagerId) || eligibleTransferManagers[0];
}

async function confirmOwnershipTransfer(selected) {
  return confirmAction({
    title: `${managerLabel(selected)}에게 소유권이전 요청`,
    message: '내부 관리자 최종 승인 후 처리됩니다. 결제가 있으면 만료 또는 해지 후 이전하고, 이후 새 소유자 카드 결제로 연결할 예정입니다.',
    confirmLabel: '요청',
  });
}

export function createManagerOwnershipActions({
  authUser,
  eligibleTransferManagers,
  managerDraft,
  ownership,
  page,
  serverPage,
  setTransferManagerId,
  transferManagerId,
  updateOwnership,
}) {
  const requestOwnershipTransfer = async () => {
    const selected = selectedTransferManager(eligibleTransferManagers, transferManagerId);
    if (!selected) {
      notify('소유권을 넘길 매니저를 먼저 추가하고 이메일을 입력하세요.', 'error');
      return;
    }
    const ok = await confirmOwnershipTransfer(selected);
    if (!ok) return;
    updateOwnership(ownershipTransferPatch({ authUser, ownership, selected }));
    setTransferManagerId(selected.id);
    notify('소유권이전 요청을 만들었습니다.', 'success');
  };

  const requestOwnershipTransferPersisted = async () => {
    const selected = selectedTransferManager(eligibleTransferManagers, transferManagerId);
    if (!serverPage) {
      await requestOwnershipTransfer();
      return;
    }
    if (!selected) {
      notify('소유권을 넘길 매니저를 먼저 추가하고 이메일을 입력하세요.', 'error');
      return;
    }
    const ok = await confirmOwnershipTransfer(selected);
    if (!ok) return;
    try {
      updateOwnership({ managers: normalizeManagerDrafts(managerDraft) });
      const request = await createServerOwnershipTransfer(page, authUser, {
        managerId: selected.id,
        managerEmail: selected.email,
      });
      updateOwnership(ownershipTransferPatch({ authUser, ownership, request, selected }));
      setTransferManagerId(selected.id);
      notify('소유권이전 요청을 저장했습니다.', 'success');
    } catch (error) {
      notify(`소유권이전 요청에 실패했습니다. ${String(error?.message || error)}`, 'error');
    }
  };

  const cancelOwnershipTransfer = async () => {
    const ok = await confirmAction({
      title: '소유권이전 요청 취소',
      message: '대기 중인 승인 요청만 취소되고 기존 소유권은 유지됩니다.',
      confirmLabel: '취소',
    });
    if (!ok) return;
    updateOwnership({ transferRequest: null });
    notify('소유권이전 요청을 취소했습니다.', 'success');
  };

  return { cancelOwnershipTransfer, requestOwnershipTransferPersisted };
}
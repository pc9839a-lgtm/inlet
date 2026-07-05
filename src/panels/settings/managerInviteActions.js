import { createLocalManagerInvite, createServerManagerInvite, managerInviteUrl } from '../../lib/managerInvites.js';
import { notify } from '../../lib/uiFeedback.js';
import { normalizeInvitePatch, normalizeManagerDrafts } from './managerSettingsState.js';

export function createManagerInviteActions({
  authUser,
  managerDraft,
  page,
  serverPage,
  setInviteLoading,
  updateManager,
  updateOwnership,
}) {
  const createInvite = async (manager, index) => {
    if (!String(manager.name || '').trim()) {
      notify('매니저 이름을 먼저 입력하세요.', 'error');
      return;
    }
    if (!manager.email) {
      notify('매니저 이메일을 먼저 입력하세요.', 'error');
      return;
    }
    if (manager.status !== 'active') {
      notify('비활성 매니저는 초대할 수 없습니다.', 'error');
      return;
    }
    updateOwnership({ managers: normalizeManagerDrafts(managerDraft) });
    setInviteLoading(manager.id || manager.email || String(index));
    try {
      const invite = serverPage
        ? await createServerManagerInvite(page, authUser, manager)
        : createLocalManagerInvite(page, manager);
      if (!invite?.token) throw new Error('초대 토큰이 없습니다.');
      const invitePatch = normalizeInvitePatch(invite);
      updateManager(index, invitePatch);
      try {
        await navigator.clipboard.writeText(invitePatch.inviteUrl);
        notify('초대 링크를 복사했습니다.', 'success');
      } catch {
        notify('초대 링크를 발급했습니다. 브라우저 권한 때문에 자동 복사는 실패했습니다.', 'warning');
      }
    } catch (error) {
      notify(`초대 링크 발급에 실패했습니다. ${String(error?.message || error)}`, 'error');
    } finally {
      setInviteLoading('');
    }
  };

  const copyInvite = async (manager) => {
    const url = manager.inviteUrl || managerInviteUrl(manager.inviteToken);
    if (!url) {
      notify('복사할 초대 링크가 없습니다.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('초대 링크를 복사했습니다.', 'success');
    } catch {
      notify('초대 링크를 직접 선택해 복사하세요.', 'warning');
    }
  };

  return { copyInvite, createInvite };
}
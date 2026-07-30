import { useLayoutEffect } from 'react';
import { fetchServerPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { defaultPage, normalize, normalizePageForSave } from '../lib/pageModel.js';
import { hasAccountProjectAccess } from '../lib/accountProjectAccess.js';
import { clearPageDraft, evaluatePageDraft, readPageDraft, restorePageDraft } from './pageDraftStore.js';

function emitBuilderToast(message, tone = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('builder:toast', { detail: { message, tone } }));
}

function offerPageDraftRecovery({ serverPage, authUser, latestPageRef, localPageMutationRef, setPage }) {
  if (typeof window === 'undefined') return;
  const draft = readPageDraft({ page: serverPage, authUser });
  if (!draft) return;
  const evaluation = evaluatePageDraft({ draft, serverPage });
  if (evaluation.action !== 'restore') {
    clearPageDraft({ page: serverPage, authUser });
    return;
  }
  const editedAt = new Date(Number(draft.editedAt || Date.now())).toLocaleString('ko-KR');
  window.dispatchEvent(new CustomEvent('builder:confirm', {
    detail: {
      title: '저장하지 않은 편집본이 있습니다.',
      message: `${editedAt}에 이 브라우저에 임시 저장한 내용입니다. 서버에 마지막으로 저장한 페이지 대신 임시 편집본을 복원할까요?`,
      confirmLabel: '임시본 복원',
      onConfirm: () => {
        const restored = restorePageDraft({ draft, serverPage });
        latestPageRef.current = restored;
        localPageMutationRef.current += 1;
        setPage(restored);
        emitBuilderToast('저장하지 않은 임시 편집본을 복원했습니다. 확인 후 저장해주세요.', 'success');
      },
      onCancel: () => {
        clearPageDraft({ page: serverPage, authUser });
        emitBuilderToast('임시 편집본을 삭제하고 서버 저장본을 유지했습니다.', 'info');
      },
    },
  }));
}

export function useAccountWorkspacePage({
  publicLandingSlug,
  authUser,
  page,
  setPage,
  accountPageLoadRef,
  latestPageRef,
  localPageMutationRef,
  setAccountPageReadyKey,
}) {
  useLayoutEffect(() => {
    if (publicLandingSlug || !authUser) {
      setAccountPageReadyKey?.('');
      return undefined;
    }
    let alive = true;
    const slug = page.slug || defaultPage.slug || 'my-page';
    const context = projectContext(page, authUser);
    const pageOwnerId = String(page.ownerId || page.ownerAccountId || '').trim();
    const pageProjectId = String(page.projectId || '').trim();
    const accountProjectAccess = hasAccountProjectAccess(page);
    const belongsToAccount = accountProjectAccess || ((!pageOwnerId || pageOwnerId === context.ownerId)
      && (!pageProjectId || pageProjectId === context.projectId || pageProjectId === context.legacyProjectId));
    if (!belongsToAccount) {
      const isolatedPage = normalizePageForSave({
        ...defaultPage,
        slug,
        projectId: context.projectId,
        ownerId: context.ownerId,
      });
      latestPageRef.current = isolatedPage;
      setPage(isolatedPage);
    }
    const loadKey = `${context.projectId}:${context.slug}:${authUser?.session || authUser?.workspaceId || authUser?.email || ''}`;
    const loadMutation = localPageMutationRef.current;
    if (accountPageLoadRef.current === loadKey) return undefined;
    accountPageLoadRef.current = loadKey;
    setAccountPageReadyKey?.('');
    fetchServerPage(slug, context)
      .then((serverPage) => {
        if (!alive) return;
        if (accountPageLoadRef.current !== loadKey) return;
        if (localPageMutationRef.current !== loadMutation) return;
        if (serverPage) {
          const nextPage = normalize({ ...serverPage, __accountProjectAccess: accountProjectAccess });
          latestPageRef.current = nextPage;
          setPage((current) => {
            if ((current.slug || '') !== slug || (current.projectId || '') !== (context.projectId || '')) return current;
            return nextPage;
          });
          offerPageDraftRecovery({ serverPage: nextPage, authUser, latestPageRef, localPageMutationRef, setPage });
          return;
        }
        const current = latestPageRef.current || page;
        const currentSlug = current.slug || slug;
        const nextContext = projectContext({ ...current, slug: currentSlug }, authUser);
        const nextPage = current.slug === currentSlug && current.projectId === nextContext.projectId && current.ownerId === nextContext.ownerId
          ? normalizePageForSave(current)
          : normalizePageForSave({
            ...current,
            slug: currentSlug,
            projectId: nextContext.projectId,
            ownerId: nextContext.ownerId,
          });
        latestPageRef.current = nextPage;
        setPage(nextPage);
        offerPageDraftRecovery({ serverPage: nextPage, authUser, latestPageRef, localPageMutationRef, setPage });
      })
      .catch((error) => {
        console.warn('Server page load failed:', error);
      })
      .finally(() => {
        if (!alive) return;
        if (accountPageLoadRef.current !== loadKey) return;
        setAccountPageReadyKey?.(loadKey);
      });
    return () => { alive = false; };
  }, [publicLandingSlug, authUser?.session, authUser?.workspaceId, authUser?.email, page.slug, page.projectId, page.ownerId]);
}

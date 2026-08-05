import { useLayoutEffect } from 'react';
import { fetchSelectedAccountPage } from '../lib/accountPageRepository.js';
import { fetchPublicServerPage, fetchServerPage } from '../lib/pageRepository.js';
import { projectContext } from '../lib/projectContext.js';
import { defaultPage, normalize, normalizePageForSave } from '../lib/pageModel.js';
import { hasAccountProjectAccess } from '../lib/accountProjectAccess.js';
import { clearPageDraft, evaluatePageDraft, readPageDraft, restorePageDraft } from './pageDraftStore.js';

function emitBuilderToast(message, tone = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('builder:toast', { detail: { message, tone } }));
}

function isRecoveredDyjhPage(serverPage = null, slug = '') {
  if (!serverPage || String(slug || serverPage.slug || '') !== 'dyjh') return false;
  const blocks = Array.isArray(serverPage.blocks) ? serverPage.blocks : [];
  if (blocks.length < 10) return false;
  let serialized = '';
  try {
    serialized = JSON.stringify(serverPage);
  } catch {
    return false;
  }
  return serialized.includes('김도윤')
    || serialized.includes('오지현')
    || serialized.includes('2026-11-28')
    || serialized.includes('삼산월드컨벤션');
}

async function fetchSelectedWorkspacePage({ page, slug, context, authUser }) {
  const exactPage = hasAccountProjectAccess(page)
    ? await fetchSelectedAccountPage(page, authUser)
    : null;
  if (exactPage) return exactPage;

  let firstError = null;
  try {
    const serverPage = await fetchServerPage(slug, context);
    if (serverPage) return serverPage;
  } catch (error) {
    firstError = error;
    console.warn('Selected workspace page load failed:', error);
  }

  if (slug !== 'dyjh') {
    if (firstError) throw firstError;
    return null;
  }

  let publicPage = null;
  try {
    publicPage = await fetchPublicServerPage(slug);
  } catch (error) {
    console.warn('Recovered dyjh identity lookup failed:', error);
  }

  const recoveredProjectId = String(publicPage?.projectId || '').trim();
  if (!recoveredProjectId || recoveredProjectId === String(context?.projectId || '')) {
    if (firstError) throw firstError;
    return null;
  }

  return fetchServerPage(slug, {
    projectId: recoveredProjectId,
    ownerId: String(publicPage?.ownerId || authUser?.ownerId || context?.ownerId || '').trim(),
    slug,
    session: authUser?.session || context?.session || '',
    legacyProjectId: '',
    legacyOwnerId: '',
  });
}

function forceRecoveredDyjhIntoEditor({
  serverPage,
  currentPage,
  authUser,
  latestPageRef,
  setPage,
}) {
  clearPageDraft({ page: currentPage, authUser });
  clearPageDraft({ page: serverPage, authUser });
  latestPageRef.current = serverPage;
  setPage(serverPage);
  emitBuilderToast('복구된 청첩장 서버 저장본을 편집 화면에 불러왔습니다.', 'success');
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
    const loadKey = `${page.id || ''}:${context.projectId}:${context.slug}:${authUser?.session || authUser?.workspaceId || authUser?.email || ''}`;
    const loadMutation = localPageMutationRef.current;
    if (accountPageLoadRef.current === loadKey) return undefined;
    accountPageLoadRef.current = loadKey;
    setAccountPageReadyKey?.('');
    fetchSelectedWorkspacePage({ page, slug, context, authUser })
      .then((serverPage) => {
        if (!alive) return;
        if (accountPageLoadRef.current !== loadKey) return;

        const currentAtResponse = latestPageRef.current || page;
        if ((currentAtResponse.slug || '') !== slug) return;
        if ((currentAtResponse.projectId || '')
          && (context.projectId || '')
          && (currentAtResponse.projectId || '') !== (context.projectId || '')) return;

        const normalizedServerPage = serverPage
          ? normalize({ ...serverPage, __accountProjectAccess: true })
          : null;

        if (isRecoveredDyjhPage(normalizedServerPage, slug)) {
          forceRecoveredDyjhIntoEditor({
            serverPage: normalizedServerPage,
            currentPage: latestPageRef.current || page,
            authUser,
            latestPageRef,
            setPage,
          });
          return;
        }

        if (localPageMutationRef.current !== loadMutation) return;
        if (normalizedServerPage) {
          const current = latestPageRef.current || page;
          if ((current.slug || '') !== slug) return;
          if ((current.projectId || '')
            && (context.projectId || '')
            && (current.projectId || '') !== (context.projectId || '')) return;
          latestPageRef.current = normalizedServerPage;
          setPage(normalizedServerPage);
          offerPageDraftRecovery({ serverPage: normalizedServerPage, authUser, latestPageRef, localPageMutationRef, setPage });
          return;
        }
        const current = latestPageRef.current || page;
        const currentSlug = current.slug || slug;
        const nextContext = projectContext({ ...current, slug: currentSlug }, authUser);
        if (currentSlug !== slug || nextContext.projectId !== context.projectId) return;
        const nextPage = current.projectId === nextContext.projectId && current.ownerId === nextContext.ownerId
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
        emitBuilderToast('선택한 페이지의 서버 저장본을 불러오지 못했습니다. 저장하지 말고 대시보드에서 다시 열어주세요.', 'error');
      })
      .finally(() => {
        if (!alive) return;
        if (accountPageLoadRef.current !== loadKey) return;
        setAccountPageReadyKey?.(loadKey);
      });
    return () => { alive = false; };
  }, [publicLandingSlug, authUser?.session, authUser?.workspaceId, authUser?.email, page.id, page.slug, page.projectId, page.ownerId]);
}

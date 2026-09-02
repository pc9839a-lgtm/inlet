import { useEffect, useRef } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { fetchServerPage } from '../lib/pageRepository.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { projectContext } from '../lib/projectContext.js';
import {
  clearPageDraft,
  pageDraftContentSignature,
  pageDraftIdentity,
  savePageDraft,
} from './pageDraftStore.js';

const REMOTE_CHECK_DEBOUNCE_MS = 1200;

function pageUpdatedAt(page = {}) {
  return String(page.updatedAt || page.savedAt || page.createdAt || '').trim();
}

function pageVersionKey(page = {}) {
  return `${Number(page.revision || 0)}:${pageUpdatedAt(page)}`;
}

function emitBuilderToast(message, tone = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('builder:toast', { detail: { message, tone } }));
}

export function remotePageFreshnessDecision({ baselinePage, currentPage, serverPage } = {}) {
  if (!baselinePage || !currentPage || !serverPage) return { action: 'none', reason: 'missing-page' };
  const baselineSignature = pageDraftContentSignature(baselinePage);
  const currentSignature = pageDraftContentSignature(currentPage);
  const serverSignature = pageDraftContentSignature(serverPage);
  const serverChanged = pageVersionKey(serverPage) !== pageVersionKey(baselinePage)
    || serverSignature !== baselineSignature;
  if (!serverChanged) return { action: 'none', reason: 'server-unchanged' };
  if (serverSignature === currentSignature) return { action: 'adopt-server', reason: 'same-content-newer-server' };
  if (currentSignature !== baselineSignature) return { action: 'preserve-local', reason: 'local-and-server-diverged' };
  return { action: 'adopt-server', reason: 'clean-local-server-advanced' };
}

export function usePageRemoteFreshness({
  publicLandingSlug,
  authUser,
  page,
  latestPageRef,
  setPage,
}) {
  const baselineRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const lastCheckedAtRef = useRef(0);
  const warnedServerVersionRef = useRef('');

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug) {
      baselineRef.current = null;
      return;
    }
    const normalized = normalizePageForSave(page || {});
    const identity = pageDraftIdentity(normalized, authUser);
    const version = pageVersionKey(normalized);
    const baseline = baselineRef.current;
    if (!baseline || baseline.identity !== identity || baseline.version !== version) {
      baselineRef.current = { identity, version, page: normalized };
      warnedServerVersionRef.current = '';
    }
  }, [authUser, page, publicLandingSlug]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug || typeof window === 'undefined') return undefined;

    const checkRemoteFreshness = async () => {
      const now = Date.now();
      if (requestInFlightRef.current || now - lastCheckedAtRef.current < REMOTE_CHECK_DEBOUNCE_MS) return;
      const currentPage = normalizePageForSave(latestPageRef.current || page || {});
      const baseline = baselineRef.current;
      const identity = pageDraftIdentity(currentPage, authUser);
      if (!baseline || baseline.identity !== identity || !currentPage.slug) return;

      requestInFlightRef.current = true;
      lastCheckedAtRef.current = now;
      try {
        const serverPage = await fetchServerPage(currentPage.slug, projectContext(currentPage, authUser));
        if (!serverPage) return;
        const normalizedServerPage = normalizePageForSave({ ...serverPage, __accountProjectAccess: true });
        const activePage = normalizePageForSave(latestPageRef.current || page || {});
        if (pageDraftIdentity(activePage, authUser) !== identity) return;

        const decision = remotePageFreshnessDecision({
          baselinePage: baseline.page,
          currentPage: activePage,
          serverPage: normalizedServerPage,
        });
        if (decision.action === 'none') return;

        if (decision.action === 'adopt-server') {
          clearPageDraft({ page: activePage, authUser });
          latestPageRef.current = normalizedServerPage;
          baselineRef.current = {
            identity,
            version: pageVersionKey(normalizedServerPage),
            page: normalizedServerPage,
          };
          setPage(normalizedServerPage);
          warnedServerVersionRef.current = '';
          if (decision.reason === 'clean-local-server-advanced') {
            emitBuilderToast('다른 곳에서 저장된 최신본을 불러왔습니다.', 'info');
          }
          return;
        }

        const recoveryDraft = savePageDraft({
          page: activePage,
          authUser,
          interactionConfirmed: true,
        });
        const serverVersion = `${identity}:${pageVersionKey(normalizedServerPage)}`;
        if (warnedServerVersionRef.current === serverVersion) return;
        warnedServerVersionRef.current = serverVersion;
        emitBuilderToast(
          recoveryDraft
            ? '다른 곳에서 저장된 변경이 있습니다. 현재 작업은 임시 보관했습니다. 저장할 때 최신본과 확인해주세요.'
            : '다른 곳에서 저장된 변경이 있습니다. 현재 작업 임시 보관에도 실패했습니다. 저장하지 말고 내용을 복사해두세요.',
          recoveryDraft ? 'warning' : 'error',
        );
      } catch (error) {
        console.warn('Remote page freshness check failed:', error);
      } finally {
        requestInFlightRef.current = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkRemoteFreshness();
    };
    window.addEventListener('focus', checkRemoteFreshness);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', checkRemoteFreshness);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authUser, latestPageRef, page.id, page.slug, page.projectId, page.ownerId, publicLandingSlug, setPage]);
}

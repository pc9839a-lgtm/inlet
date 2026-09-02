import { useEffect, useLayoutEffect, useRef } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { AUTH_KEY, EVENTS_KEY, LEADS_KEY, STORAGE_KEY } from '../config/storageKeys.js';
import { normalizeAuthUser } from '../lib/authIdentity.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import {
  pageDraftContentSignature,
  pageDraftIdentity,
  pageDraftStorageFailureMessage,
  savePageDraftResult,
} from './pageDraftStore.js';
import {
  setWorkspaceRecoveryFlusher,
  setWorkspaceUnsavedDirty,
  shouldBlockWorkspaceBeforeUnload,
} from './workspaceUnsavedGuard.js';

const SERVER_DRAFT_DELAY_MS = 550;
const SERVER_BASELINE_STABILIZE_MS = 1200;
const USER_EDIT_INTENT_WINDOW_MS = 5000;

export function useLocalWorkspacePersistence({
  authUser,
  events,
  latestPageRef,
  leads,
  page,
  publicLandingSlug,
  saveLocalJson,
  setAuthUser,
}) {
  const serverBaselineRef = useRef(null);
  const serverDraftTimerRef = useRef(null);
  const serverDraftDirtyRef = useRef(false);
  const lastUserEditIntentRef = useRef(0);
  const draftStorageFailureNoticeRef = useRef('');

  const recordDraftStorageResult = (result) => {
    serverDraftDirtyRef.current = !result?.ok;
    if (result?.ok) {
      lastUserEditIntentRef.current = 0;
      draftStorageFailureNoticeRef.current = '';
      return true;
    }

    if (typeof window !== 'undefined') {
      const signature = `${result?.reason || 'storage'}:${result?.error?.name || ''}`;
      if (draftStorageFailureNoticeRef.current !== signature) {
        draftStorageFailureNoticeRef.current = signature;
        window.dispatchEvent(new CustomEvent('builder:toast', {
          detail: { message: pageDraftStorageFailureMessage(result), tone: 'error' },
        }));
      }
    }
    return false;
  };

  const persistRecoveryDraft = (pageValue) => recordDraftStorageResult(savePageDraftResult({
    page: pageValue,
    authUser,
    interactionConfirmed: true,
  }));

  useEffect(() => {
    if (publicLandingSlug) return;
    if (isServerPageMode()) return;
    saveLocalJson(STORAGE_KEY, normalizePageForSave(page), '페이지');
  }, [page, publicLandingSlug]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug || typeof window === 'undefined') return undefined;

    const markUserEditIntent = (event) => {
      const target = event?.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.edit-layout, .style-panel, .settings-panel')) return;
      if (event.type === 'keydown') {
        const key = String(event.key || '');
        if (['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(key)) return;
      }
      lastUserEditIntentRef.current = Date.now();
      if (event.type === 'input' || event.type === 'change' || event.type === 'keydown') {
        serverDraftDirtyRef.current = true;
        setWorkspaceUnsavedDirty(true);
      }
    };

    const options = { capture: true, passive: true };
    window.addEventListener('input', markUserEditIntent, options);
    window.addEventListener('change', markUserEditIntent, options);
    window.addEventListener('pointerdown', markUserEditIntent, options);
    window.addEventListener('keydown', markUserEditIntent, true);

    return () => {
      window.removeEventListener('input', markUserEditIntent, true);
      window.removeEventListener('change', markUserEditIntent, true);
      window.removeEventListener('pointerdown', markUserEditIntent, true);
      window.removeEventListener('keydown', markUserEditIntent, true);
    };
  }, [authUser?.session, publicLandingSlug]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug) return undefined;

    const normalized = normalizePageForSave(page);
    const identity = pageDraftIdentity(normalized, authUser);
    const revision = Number(normalized.revision || 0);
    const updatedAt = String(normalized.updatedAt || normalized.savedAt || normalized.createdAt || '');
    const signature = pageDraftContentSignature(normalized);
    const baseline = serverBaselineRef.current;
    const identityChanged = !baseline || baseline.identity !== identity;
    const baseChanged = identityChanged
      || baseline.revision !== revision
      || baseline.updatedAt !== updatedAt;

    if (baseChanged) {
      if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);
      serverDraftTimerRef.current = null;
      serverDraftDirtyRef.current = false;
      lastUserEditIntentRef.current = 0;
      draftStorageFailureNoticeRef.current = '';
      serverBaselineRef.current = { identity, revision, updatedAt, signature, observedAt: Date.now() };
      if (identityChanged) setWorkspaceUnsavedDirty(false);
      return undefined;
    }

    if (baseline.signature === signature) return undefined;

    const now = Date.now();
    const lastUserIntentAt = Number(lastUserEditIntentRef.current || 0);
    const hasRecentUserIntent = lastUserIntentAt > 0 && now - lastUserIntentAt <= USER_EDIT_INTENT_WINDOW_MS;
    if (!hasRecentUserIntent) {
      baseline.signature = signature;
      baseline.observedAt = now;
      serverDraftDirtyRef.current = false;
      return undefined;
    }

    const flushPendingDraft = () => {
      if (!serverDraftDirtyRef.current) return true;
      return persistRecoveryDraft(latestPageRef.current || normalized);
    };

    serverDraftDirtyRef.current = true;
    setWorkspaceUnsavedDirty(true);
    if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);
    const waitForBaseline = Math.max(0, SERVER_BASELINE_STABILIZE_MS - (now - Number(baseline.observedAt || 0)));
    serverDraftTimerRef.current = setTimeout(() => {
      flushPendingDraft();
      serverDraftTimerRef.current = null;
    }, SERVER_DRAFT_DELAY_MS + waitForBaseline);

    return () => {
      if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);
      serverDraftTimerRef.current = null;
      flushPendingDraft();
    };
  }, [page, publicLandingSlug, authUser]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug || typeof window === 'undefined') {
      setWorkspaceRecoveryFlusher(null);
      setWorkspaceUnsavedDirty(false);
      return undefined;
    }

    const flushDraft = () => {
      const currentPage = latestPageRef.current || page;
      const normalized = normalizePageForSave(currentPage);
      const baseline = serverBaselineRef.current;
      const sameIdentity = baseline?.identity === pageDraftIdentity(normalized, authUser);
      const signatureChanged = sameIdentity && baseline?.signature !== pageDraftContentSignature(normalized);
      const lastUserIntentAt = Number(lastUserEditIntentRef.current || 0);
      const hasRecentUserIntent = lastUserIntentAt > 0 && Date.now() - lastUserIntentAt <= USER_EDIT_INTENT_WINDOW_MS;
      if (!serverDraftDirtyRef.current && !(signatureChanged && hasRecentUserIntent)) return true;
      return persistRecoveryDraft(normalized);
    };

    setWorkspaceRecoveryFlusher(flushDraft);

    const handleBeforeUnload = (event) => {
      flushDraft();
      if (!shouldBlockWorkspaceBeforeUnload()) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDraft();
    };

    window.addEventListener('pagehide', flushDraft);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', flushDraft);
    window.addEventListener('hashchange', flushDraft);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      flushDraft();
      setWorkspaceRecoveryFlusher(null);
      window.removeEventListener('pagehide', flushDraft);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', flushDraft);
      window.removeEventListener('hashchange', flushDraft);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authUser, latestPageRef, page, publicLandingSlug]);

  useEffect(() => {
    saveLocalJson(LEADS_KEY, leads, '접수 데이터', { quietSuccess: true });
  }, [leads]);

  useEffect(() => {
    saveLocalJson(EVENTS_KEY, events, '통계 이벤트', { quietSuccess: true });
  }, [events]);

  useEffect(() => {
    if (!authUser) return;
    const normalized = normalizeAuthUser(authUser);
    saveLocalJson(AUTH_KEY, normalized, '로그인 정보', { quietSuccess: true });
    if (JSON.stringify(normalized) !== JSON.stringify(authUser)) setAuthUser(normalized);
  }, [authUser]);

  useLayoutEffect(() => {
    latestPageRef.current = page;
  }, [latestPageRef, page]);
}

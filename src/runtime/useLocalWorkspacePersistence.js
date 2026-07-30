import { useEffect, useRef } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { AUTH_KEY, EVENTS_KEY, LEADS_KEY, STORAGE_KEY } from '../config/storageKeys.js';
import { normalizeAuthUser } from '../lib/authIdentity.js';
import { normalizePageForSave } from '../lib/pageModel.js';
import { pageDraftContentSignature, pageDraftIdentity, savePageDraft } from './pageDraftStore.js';

const SERVER_DRAFT_DELAY_MS = 550;
const SERVER_BASELINE_STABILIZE_MS = 1200;

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

  useEffect(() => {
    if (publicLandingSlug) return;
    if (isServerPageMode()) return;
    saveLocalJson(STORAGE_KEY, normalizePageForSave(page), '페이지');
  }, [page, publicLandingSlug]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug) return undefined;

    const normalized = normalizePageForSave(page);
    const identity = pageDraftIdentity(normalized, authUser);
    const revision = Number(normalized.revision || 0);
    const updatedAt = String(normalized.updatedAt || normalized.savedAt || normalized.createdAt || '');
    const signature = pageDraftContentSignature(normalized);
    const baseline = serverBaselineRef.current;
    const baseChanged = !baseline
      || baseline.identity !== identity
      || baseline.revision !== revision
      || baseline.updatedAt !== updatedAt;

    if (baseChanged) {
      if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);
      serverDraftTimerRef.current = null;
      serverDraftDirtyRef.current = false;
      serverBaselineRef.current = { identity, revision, updatedAt, signature, observedAt: Date.now() };
      return undefined;
    }

    if (baseline.signature === signature) return undefined;
    serverDraftDirtyRef.current = true;
    if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);
    const waitForBaseline = Math.max(0, SERVER_BASELINE_STABILIZE_MS - (Date.now() - Number(baseline.observedAt || 0)));
    serverDraftTimerRef.current = setTimeout(() => {
      const draft = savePageDraft({ page: latestPageRef.current || normalized, authUser });
      serverDraftDirtyRef.current = !draft;
      serverDraftTimerRef.current = null;
      if (!draft && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('builder:toast', {
          detail: { message: '편집 내용 임시 저장에 실패했습니다. 브라우저 저장 공간을 확인해주세요.', tone: 'error' },
        }));
      }
    }, SERVER_DRAFT_DELAY_MS + waitForBaseline);

    return () => {
      if (serverDraftTimerRef.current) clearTimeout(serverDraftTimerRef.current);
      serverDraftTimerRef.current = null;
    };
  }, [page, publicLandingSlug, authUser]);

  useEffect(() => {
    if (!isServerPageMode() || !authUser || publicLandingSlug) return undefined;
    const flushDraft = () => {
      if (!serverDraftDirtyRef.current) return;
      const draft = savePageDraft({ page: latestPageRef.current || page, authUser });
      serverDraftDirtyRef.current = !draft;
    };
    window.addEventListener('pagehide', flushDraft);
    window.addEventListener('beforeunload', flushDraft);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      window.removeEventListener('beforeunload', flushDraft);
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

  useEffect(() => {
    latestPageRef.current = page;
  }, [latestPageRef, page]);
}

import { useEffect } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { AUTH_KEY, EVENTS_KEY, LEADS_KEY, STORAGE_KEY } from '../config/storageKeys.js';
import { normalizeAuthUser } from '../lib/authIdentity.js';
import { normalizePageForSave } from '../lib/pageModel.js';

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
  useEffect(() => {
    if (publicLandingSlug) return;
    if (isServerPageMode()) return;
    saveLocalJson(STORAGE_KEY, normalizePageForSave(page), '\uD398\uC774\uC9C0');
  }, [page, publicLandingSlug]);

  useEffect(() => {
    saveLocalJson(LEADS_KEY, leads, '\uC811\uC218 \uB370\uC774\uD130', { quietSuccess: true });
  }, [leads]);

  useEffect(() => {
    saveLocalJson(EVENTS_KEY, events, '\uD1B5\uACC4 \uC774\uBCA4\uD2B8', { quietSuccess: true });
  }, [events]);

  useEffect(() => {
    if (!authUser) return;
    const normalized = normalizeAuthUser(authUser);
    saveLocalJson(AUTH_KEY, normalized, '\uB85C\uADF8\uC778 \uC815\uBCF4', { quietSuccess: true });
    if (JSON.stringify(normalized) !== JSON.stringify(authUser)) setAuthUser(normalized);
  }, [authUser]);

  useEffect(() => {
    latestPageRef.current = page;
  }, [latestPageRef, page]);
}

import { useEffect } from 'react';
import { isServerPageMode } from '../config/runtimeConfig.js';
import { AUTH_KEY, DASHBOARD_KEY } from '../config/storageKeys.js';
import { refreshAuthSession } from '../lib/authAccounts.js';
import { normalizeAuthUser } from '../lib/authIdentity.js';

export function useAuthSessionEffects({
  authUser,
  pageProjectId,
  publicLandingSlug,
  sessionRefreshRef,
  saveLocalJson,
  setAuthUser,
  setWorkspaceOpen,
  setAuthView,
  showToast,
}) {
  useEffect(() => {
    if (publicLandingSlug || !authUser || !isServerPageMode()) return;
    if (String(authUser.session || '').trim()) return;
    localStorage.removeItem(AUTH_KEY);
    saveLocalJson(DASHBOARD_KEY, { open: false }, '\uC791\uC5C5\uACF5\uAC04 \uC0C1\uD0DC', { quietSuccess: true });
    setAuthUser(null);
    setWorkspaceOpen(false);
    setAuthView('login');
    showToast('\uB85C\uADF8\uC778 \uC138\uC158\uC774 \uC5C6\uC5B4 \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574\uC57C \uD569\uB2C8\uB2E4.', 'error');
  }, [authUser?.email, authUser?.session, publicLandingSlug]);

  useEffect(() => {
    const session = String(authUser?.session || '').trim();
    if (!session || sessionRefreshRef.current === session) return undefined;
    sessionRefreshRef.current = session;
    let alive = true;
    refreshAuthSession({ session, projectId: pageProjectId || '' })
      .then((nextUser) => {
        if (!alive || !nextUser) return;
        const normalized = normalizeAuthUser({
          ...authUser,
          ...nextUser,
          session: nextUser.session || session,
          signedAt: new Date().toISOString(),
        });
        sessionRefreshRef.current = String(normalized.session || session);
        saveLocalJson(AUTH_KEY, normalized, '\uB85C\uADF8\uC778 \uC815\uBCF4', { quietSuccess: true });
        setAuthUser(normalized);
      })
      .catch((error) => {
        if (!alive) return;
        const status = Number(error?.status || 0);
        if (status === 401 || status === 403 || status === 404) {
          localStorage.removeItem(AUTH_KEY);
          setAuthUser(null);
          setWorkspaceOpen(false);
          showToast('\uB85C\uADF8\uC778 \uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.', 'error');
        }
      });
    return () => { alive = false; };
  }, [authUser?.session, pageProjectId]);
}

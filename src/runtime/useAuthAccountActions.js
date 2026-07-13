import { AUTH_KEY, DASHBOARD_KEY } from '../config/storageKeys.js';
import { logoutAuthAccount, updateAuthAccount } from '../lib/authAccounts.js';
import { normalizeAuthUser } from '../lib/authIdentity.js';
import { fetchServerPage } from '../lib/pageRepository.js';
import { normalize, normalizePageForSave } from '../lib/pageModel.js';

export function createAuthAccountActions({
  authUser,
  page,
  saveLocalJson,
  setAuthUser,
  setAuthView,
  setPage,
  setWorkspaceOpen,
  showToast,
}) {
  const logout = () => {
    const session = String(authUser?.session || '').trim();
    if (session) {
      logoutAuthAccount({ session }).catch((error) => {
        console.warn('Session logout request failed:', error);
      });
    }
    localStorage.removeItem(AUTH_KEY);
    saveLocalJson(DASHBOARD_KEY, { open: false }, '\uC791\uC5C5\uACF5\uAC04 \uC0C1\uD0DC', { quietSuccess: true });
    setAuthUser(null);
    setAuthView('');
    setWorkspaceOpen(false);
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  const acceptAuth = (user) => {
    const normalized = normalizeAuthUser(user);
    saveLocalJson(AUTH_KEY, normalized, '\uB85C\uADF8\uC778 \uC815\uBCF4', { quietSuccess: true });
    setAuthUser(normalized);
    setAuthView('');
    if (typeof history !== 'undefined') history.replaceState(null, '', '/app');
  };

  const updateAccountProfile = async (patch = {}) => {
    const session = String(authUser?.session || '').trim();
    if (!session) {
      showToast('\uB85C\uADF8\uC778 \uC138\uC158\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.', 'error');
      throw new Error('Missing session');
    }
    const updated = await updateAuthAccount({
      ...patch,
      session,
      projectId: page.projectId || '',
    });
    const normalized = normalizeAuthUser({
      ...authUser,
      ...updated,
      session: updated?.session || session,
      signedAt: new Date().toISOString(),
    });
    saveLocalJson(AUTH_KEY, normalized, '\uB85C\uADF8\uC778 \uC815\uBCF4', { quietSuccess: true });
    setAuthUser(normalized);
    showToast('\uACC4\uC815 \uC815\uBCF4\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'ok');
    return normalized;
  };

  const acceptInviteAuth = async (result = {}) => {
    const manager = result.manager || {};
    const project = result.project || {};
    const normalized = normalizeAuthUser({
      name: manager.name || manager.email || '\uB9E4\uB2C8\uC800',
      email: manager.email || '',
      workspaceId: manager.ownerId || '',
      role: 'manager',
      accessMode: 'manager',
      session: result.session || '',
      defaultProject: project,
      signedAt: new Date().toISOString(),
    });
    saveLocalJson(AUTH_KEY, normalized, '\uB85C\uADF8\uC778 \uC815\uBCF4', { quietSuccess: true });
    setAuthUser(normalized);
    setAuthView('');
    if (typeof history !== 'undefined') history.replaceState(null, '', '/app');

    const projectSlug = project.slug || page.slug;
    const projectContextForInvite = {
      projectId: project.projectId || page.projectId,
      ownerId: project.ownerId || '',
      slug: projectSlug,
      session: result.session || '',
    };
    try {
      const serverPage = await fetchServerPage(projectSlug, projectContextForInvite);
      if (serverPage) {
        setPage(normalize(serverPage));
      } else {
        setPage((current) => normalizePageForSave({
          ...current,
          slug: projectSlug,
          projectId: project.projectId || current.projectId,
        }));
      }
    } catch (error) {
      console.warn('Invite project page load failed:', error);
      setPage((current) => normalizePageForSave({
        ...current,
        slug: projectSlug,
        projectId: project.projectId || current.projectId,
      }));
    }
    saveLocalJson(DASHBOARD_KEY, { open: true }, '\uC791\uC5C5\uACF5\uAC04 \uC0C1\uD0DC', { quietSuccess: true });
    setWorkspaceOpen(true);
  };

  return { acceptAuth, acceptInviteAuth, logout, updateAccountProfile };
}

import { useEffect } from 'react';

export function useProtectedWorkspaceRedirect({ authUser, protectedWorkspacePath }) {
  useEffect(() => {
    if (authUser || !protectedWorkspacePath) return;
    window.location.replace('/');
  }, [authUser, protectedWorkspacePath]);
}

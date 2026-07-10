import { useEffect } from 'react';

export function useWorkspaceAutoOpen({ authUser, canUseBuilder, workspaceOpen, persistOpenState, setWorkspaceOpen }) {
  useEffect(() => {
    if (!authUser || canUseBuilder || workspaceOpen) return;
    persistOpenState(true);
    setWorkspaceOpen(true);
  }, [authUser, canUseBuilder, persistOpenState, setWorkspaceOpen, workspaceOpen]);
}

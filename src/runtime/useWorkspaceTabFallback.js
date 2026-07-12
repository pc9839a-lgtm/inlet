import { useEffect } from 'react';
import { replaceLocationTab } from './workspaceTabLocation.js';

export function useWorkspaceTabFallback({ authUser, routeUsesWorkspaceTabs, allowedTabs, tab, tabKeys, clearPendingStyle, setTab }) {
  useEffect(() => {
    if (!authUser) return;
    if (!routeUsesWorkspaceTabs) return;
    if (allowedTabs.includes(tab)) return;
    clearPendingStyle();
    const nextTab = allowedTabs[0];
    if (!nextTab) return;
    replaceLocationTab(tabKeys, nextTab);
    setTab(nextTab);
  }, [allowedTabs, authUser, clearPendingStyle, routeUsesWorkspaceTabs, setTab, tab, tabKeys]);
}

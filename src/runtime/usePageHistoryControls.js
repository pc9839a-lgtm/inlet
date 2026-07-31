import { useEffect, useSyncExternalStore } from 'react';
import {
  getPageHistoryState,
  redoPageHistory,
  subscribePageHistory,
  syncPageHistoryPage,
  undoPageHistory,
} from './pageHistoryStore.js';

function shouldIgnoreShortcut(event) {
  if (event.altKey) return true;
  if (typeof document === 'undefined') return false;
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
  return false;
}

export function usePageHistoryControls(page, { enabled = true } = {}) {
  const history = useSyncExternalStore(subscribePageHistory, getPageHistoryState, getPageHistoryState);

  useEffect(() => {
    syncPageHistoryPage(page);
  }, [page]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (shouldIgnoreShortcut(event)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      const key = String(event.key || '').toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = (key === 'z' && event.shiftKey) || key === 'y';
      if (!wantsUndo && !wantsRedo) return;
      const handled = wantsRedo ? redoPageHistory() : undoPageHistory();
      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);

  return {
    ...history,
    undo: undoPageHistory,
    redo: redoPageHistory,
  };
}

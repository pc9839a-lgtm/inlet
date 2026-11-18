import { useEffect, useState } from 'react';

// The optional controlled draft lives in the workspace and survives block changes.
// Keep the local fallback for isolated editors outside that workspace.
//
// The responsive workbench relocates active widgets between the inline row
// and narrow Inspector. Preserve only an open dialog for that exact block,
// so a viewport/virtual-keyboard resize cannot unmount the dialog mid-edit.
// No code text or published data is stored in this registry.
const openCodeDialogs = new Set();
const MAX_OPEN_DIALOGS = 16;

export function useCodeDraft(html, stagedDraft, onDraftChange, blockId = '') {
  const [localDraft, setLocalDraft] = useState(html || '');
  const [modalOpen, setLocalModalOpen] = useState(() => !!blockId && openCodeDialogs.has(blockId));
  const setModalOpen = (nextValue) => {
    const next = typeof nextValue === 'function' ? !!nextValue(modalOpen) : !!nextValue;
    if (blockId) {
      if (next) {
        if (openCodeDialogs.size >= MAX_OPEN_DIALOGS && !openCodeDialogs.has(blockId)) {
          openCodeDialogs.delete(openCodeDialogs.values().next().value);
        }
        openCodeDialogs.add(blockId);
      } else {
        openCodeDialogs.delete(blockId);
      }
    }
    setLocalModalOpen(next);
  };

  useEffect(() => {
    if (stagedDraft === undefined) setLocalDraft(html || '');
  }, [html, stagedDraft]);

  const draft = stagedDraft === undefined ? localDraft : stagedDraft;
  const setDraft = (value) => {
    if (typeof onDraftChange === 'function') onDraftChange(value);
    else setLocalDraft(value);
  };

  return { draft, setDraft, modalOpen, setModalOpen };
}

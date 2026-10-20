import { useEffect, useState } from 'react';

// The optional controlled draft lives in the workspace and survives block changes.
// Keep the local fallback for isolated editors outside that workspace.
export function useCodeDraft(html, stagedDraft, onDraftChange) {
  const [localDraft, setLocalDraft] = useState(html || '');
  const [modalOpen, setModalOpen] = useState(false);

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

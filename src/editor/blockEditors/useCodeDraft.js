import { useState } from 'react';

// The unapplied HTML lives in the page's local draft, not component state.
// Switching blocks or remounting this editor must not erase it.
export function useCodeDraft(html, codeDraft, update) {
  const [modalOpen, setModalOpen] = useState(false);
  const draft = typeof codeDraft === 'string' ? codeDraft : (html || '');
  const setDraft = (value) => update({ codeDraft: String(value).slice(0, 40000) });
  return { draft, setDraft, modalOpen, setModalOpen };
}

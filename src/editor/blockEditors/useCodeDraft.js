import { useEffect, useState } from 'react';

export function useCodeDraft(html) {
  const [draft, setDraft] = useState(html || '');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setDraft(html || '');
  }, [html]);

  return { draft, setDraft, modalOpen, setModalOpen };
}
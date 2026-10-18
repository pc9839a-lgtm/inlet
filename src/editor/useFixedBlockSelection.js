import React from 'react';

export function useFixedBlockSelection({ setAddOpen }) {
  const [fixedOpenId, setFixedOpenId] = React.useState('');

  React.useEffect(() => {
    const handlePreviewSelection = (event) => {
      const id = String(event.detail?.id || '');
      if (!id) return;
      setAddOpen(false);
      setFixedOpenId(id);
    };
    window.addEventListener('pagero:select-fixed-block', handlePreviewSelection);
    return () => window.removeEventListener('pagero:select-fixed-block', handlePreviewSelection);
  }, [setAddOpen]);

  const toggleBlockOpen = React.useCallback((blockId) => {
    setAddOpen(false);
    setFixedOpenId((current) => (current === blockId ? '' : blockId));
  }, [setAddOpen]);

  return { fixedOpenId, toggleBlockOpen };
}
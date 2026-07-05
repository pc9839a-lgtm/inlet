import React from 'react';

export function useFixedBlockSelection({ setAddOpen }) {
  const [fixedOpenId, setFixedOpenId] = React.useState('');

  const toggleBlockOpen = React.useCallback((blockId) => {
    setAddOpen(false);
    setFixedOpenId((current) => (current === blockId ? '' : blockId));
  }, [setAddOpen]);

  return { fixedOpenId, toggleBlockOpen };
}
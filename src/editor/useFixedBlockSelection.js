import React from 'react';

export function useFixedBlockSelection({ setAddOpen, setOpenId, openId, fixedBlockIds = [] }) {
  const [fixedOpenId, setFixedOpenId] = React.useState('');

  const selectedFixedId = fixedBlockIds.includes(openId) ? openId : '';

  React.useEffect(() => {
    setFixedOpenId(selectedFixedId);
  }, [selectedFixedId]);

  const toggleBlockOpen = React.useCallback((blockId) => {
    setAddOpen(false);
    const nextId = fixedOpenId === blockId ? '' : blockId;
    setFixedOpenId(nextId);
    setOpenId(nextId);
  }, [fixedOpenId, setAddOpen, setOpenId]);

  return { fixedOpenId, toggleBlockOpen };
}
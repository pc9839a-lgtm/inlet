import React from 'react';

// The page's openId is the only selection source. Avoid one-render lag from a
// second local state when selecting a fixed block directly from the preview.
export function useFixedBlockSelection({ setAddOpen, setOpenId, openId, fixedBlockIds = [] }) {
  const fixedOpenId = fixedBlockIds.includes(openId) ? openId : '';

  const toggleBlockOpen = React.useCallback((blockId) => {
    if (!fixedBlockIds.includes(blockId)) return;
    setAddOpen(false);
    setOpenId((current) => (current === blockId ? '' : blockId));
  }, [fixedBlockIds, setAddOpen, setOpenId]);

  return { fixedOpenId, toggleBlockOpen };
}

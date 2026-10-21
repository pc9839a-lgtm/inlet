import React from 'react';
import { isSelectedOpenIdNormalBlock } from './editPanelSelectionModel.js';

export function useNormalBlockSelection({
  normalBlocks,
  openId,
  setOpenId,
  setAddOpen,
}) {
  const normalSelectedId = isSelectedOpenIdNormalBlock(normalBlocks, openId) ? openId : '';

  const selectBlock = React.useCallback((blockId) => {
    setAddOpen(false);

    setOpenId((current) => (current === blockId ? '' : blockId));
  }, [setAddOpen, setOpenId]);

  // Navigation from a preview or newly inserted block must be idempotent.
  // Toggling the active row is intentionally limited to direct row clicks.
  const openBlockSettings = React.useCallback((blockId) => {
    setAddOpen(false);
    setOpenId(blockId);
  }, [setAddOpen, setOpenId]);

  return { normalSelectedId, selectBlock, openBlockSettings };
}
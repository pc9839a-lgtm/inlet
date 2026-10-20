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

  const openBlockSettings = React.useCallback((blockId) => {
    selectBlock(blockId);
  }, [selectBlock]);

  return { normalSelectedId, selectBlock, openBlockSettings };
}
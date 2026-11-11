import React from 'react';
import { isSelectedOpenIdNormalBlock } from './editPanelSelectionModel.js';

export function useNormalBlockSelection({
  normalBlocks,
  openId,
  setOpenId,
  setAddOpen,
}) {
  const normalSelectedId = isSelectedOpenIdNormalBlock(normalBlocks, openId) ? openId : '';

  // Selecting an already active block must keep its editor open.
  // Page settings uses the explicit clear action instead of a second click.
  const selectBlock = React.useCallback((blockId) => {
    if (!normalBlocks.some((block) => block.id === blockId)) return;
    setAddOpen(false);
    setOpenId(blockId);
  }, [normalBlocks, setAddOpen, setOpenId]);

  const clearBlockSelection = React.useCallback(() => {
    setAddOpen(false);
    setOpenId('');
  }, [setAddOpen, setOpenId]);

  const openBlockSettings = React.useCallback((blockId) => {
    selectBlock(blockId);
  }, [selectBlock]);

  return { normalSelectedId, selectBlock, clearBlockSelection, openBlockSettings };
}
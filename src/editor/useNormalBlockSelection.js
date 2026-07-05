import React from 'react';
import {
  isSelectedOpenIdNormalBlock,
  resolveSelectedNormalId,
} from './editPanelSelectionModel.js';

export function useNormalBlockSelection({
  normalBlocks,
  openId,
  setOpenId,
  setAddOpen,
  scrollToSelectedSettings,
}) {
  const [selectedNormalId, setSelectedNormalId] = React.useState('');
  const openIdIsNormalBlock = isSelectedOpenIdNormalBlock(normalBlocks, openId);
  const normalSelectedId = resolveSelectedNormalId({ normalBlocks, openId, selectedNormalId });

  React.useEffect(() => {
    if (!openIdIsNormalBlock || openId === selectedNormalId) return;
    setSelectedNormalId(openId);
  }, [openId, openIdIsNormalBlock, selectedNormalId]);

  const selectBlock = React.useCallback((blockId, options = {}) => {
    setAddOpen(false);
    setSelectedNormalId(blockId);
    setOpenId(blockId);
    if (options.scroll) scrollToSelectedSettings();
  }, [scrollToSelectedSettings, setAddOpen, setOpenId]);

  const openBlockSettings = React.useCallback((blockId) => {
    selectBlock(blockId, { scroll: true });
  }, [selectBlock]);

  return { normalSelectedId, selectBlock, openBlockSettings };
}
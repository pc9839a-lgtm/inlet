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
}) {
  const [selectedNormalId, setSelectedNormalId] = React.useState('');
  const openIdIsNormalBlock = isSelectedOpenIdNormalBlock(normalBlocks, openId);
  const normalSelectedId = resolveSelectedNormalId({ normalBlocks, openId, selectedNormalId });

  React.useEffect(() => {
    if (!openIdIsNormalBlock || openId === selectedNormalId) return;
    setSelectedNormalId(openId);
  }, [openId, openIdIsNormalBlock, selectedNormalId]);

  const selectBlock = React.useCallback((blockId) => {
    setAddOpen(false);

    if (normalSelectedId === blockId) {
      setSelectedNormalId('');
      setOpenId('');
      return;
    }

    setSelectedNormalId(blockId);
    setOpenId(blockId);
  }, [normalSelectedId, setAddOpen, setOpenId]);

  const openBlockSettings = React.useCallback((blockId) => {
    selectBlock(blockId);
  }, [selectBlock]);

  return { normalSelectedId, selectBlock, openBlockSettings };
}
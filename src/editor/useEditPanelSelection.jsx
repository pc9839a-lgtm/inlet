import React from 'react';
import {
  findSelectedNormalBlock,
  getEditPanelSelectionBlocks,
  getSelectedNormalMeta,
  shouldHideTopNavControl,
} from './editPanelSelectionModel.js';
import { useFixedBlockSelection } from './useFixedBlockSelection.js';
import { useNormalBlockSelection } from './useNormalBlockSelection.js';
import { useSelectedSettingsScroll } from './useSelectedSettingsScroll.js';

export function useEditPanelSelection({ page, openId, setOpenId, setAddOpen }) {
  const { topNavBlock, bottomBlock, footerBlock, normalBlocks } = React.useMemo(() => getEditPanelSelectionBlocks(page), [page]);
  const { selectedSettingsRef, scrollToSelectedSettings } = useSelectedSettingsScroll();
  const { fixedOpenId, toggleBlockOpen } = useFixedBlockSelection({ setAddOpen });
  const { normalSelectedId, selectBlock, openBlockSettings } = useNormalBlockSelection({
    normalBlocks,
    openId,
    setOpenId,
    setAddOpen,
    scrollToSelectedSettings,
  });

  const selectedNormalBlock = findSelectedNormalBlock(normalBlocks, normalSelectedId);
  const selectedNormalMeta = getSelectedNormalMeta(selectedNormalBlock);
  const hideTopNavControl = shouldHideTopNavControl(page, topNavBlock);

  return {
    topNavBlock,
    bottomBlock,
    footerBlock,
    normalBlocks,
    normalSelectedId,
    selectedNormalBlock,
    selectedNormalMeta,
    hideTopNavControl,
    fixedOpenId,
    selectedSettingsRef,
    toggleBlockOpen,
    selectBlock,
    openBlockSettings,
  };
}
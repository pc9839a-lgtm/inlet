import React from 'react';
import {
  getEditPanelSelectionBlocks,
  shouldHideTopNavControl,
} from './editPanelSelectionModel.js';
import { useFixedBlockSelection } from './useFixedBlockSelection.js';
import { useNormalBlockSelection } from './useNormalBlockSelection.js';

export function useEditPanelSelection({ page, openId, setOpenId, setAddOpen }) {
  const { topNavBlock, bottomBlock, footerBlock, normalBlocks } = React.useMemo(() => getEditPanelSelectionBlocks(page), [page]);
  const { fixedOpenId, toggleBlockOpen } = useFixedBlockSelection({ setAddOpen });
  const { normalSelectedId, selectBlock, openBlockSettings } = useNormalBlockSelection({
    normalBlocks,
    openId,
    setOpenId,
    setAddOpen,
  });

  const hideTopNavControl = shouldHideTopNavControl(page, topNavBlock);

  return {
    topNavBlock,
    bottomBlock,
    footerBlock,
    normalBlocks,
    normalSelectedId,
    hideTopNavControl,
    fixedOpenId,
    toggleBlockOpen,
    selectBlock,
    openBlockSettings,
  };
}
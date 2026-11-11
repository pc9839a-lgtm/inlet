import React from 'react';
import {
  getEditPanelSelectionBlocks,
  shouldHideTopNavControl,
} from './editPanelSelectionModel.js';
import { useFixedBlockSelection } from './useFixedBlockSelection.js';
import { useNormalBlockSelection } from './useNormalBlockSelection.js';

export function useEditPanelSelection({ page, openId, setOpenId, setAddOpen }) {
  const { topNavBlock, bottomBlock, footerBlock, normalBlocks } = React.useMemo(() => getEditPanelSelectionBlocks(page), [page]);

  // Open the first visible content editor on initial entry, not the global
  // design form. This runs once per page: explicitly opening Page Settings
  // must never reselect a block, and an existing selection always wins.
  const firstSelectionPageRef = React.useRef('');
  const pageIdentity = String(page?.id || page?.slug || 'unsaved');
  React.useEffect(() => {
    if (firstSelectionPageRef.current === pageIdentity) return;
    const firstVisibleBlock = normalBlocks.find((block) => block.visible !== false);
    if (!firstVisibleBlock) return;
    firstSelectionPageRef.current = pageIdentity;
    if (!openId) setOpenId(firstVisibleBlock.id);
  }, [normalBlocks, openId, pageIdentity, setOpenId]);

  const { fixedOpenId, toggleBlockOpen } = useFixedBlockSelection({
    setAddOpen,
    setOpenId,
    openId,
    fixedBlockIds: [topNavBlock?.id, bottomBlock?.id, footerBlock?.id].filter(Boolean),
  });
  const { normalSelectedId, selectBlock, clearBlockSelection, openBlockSettings } = useNormalBlockSelection({
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
    clearBlockSelection,
    openBlockSettings,
  };
}
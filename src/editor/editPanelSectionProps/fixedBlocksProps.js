export function createFixedBlocksProps({
  selection,
  toggleVisible,
  renderTopNavEditor,
  renderBottomBarEditor,
  renderFooterEditor,
}) {
  return {
    topNavBlock: selection.topNavBlock,
    bottomBlock: selection.bottomBlock,
    footerBlock: selection.footerBlock,
    hideTopNavControl: selection.hideTopNavControl,
    openId: selection.fixedOpenId,
    toggleVisible,
    toggleBlockOpen: selection.toggleBlockOpen,
    renderTopNavEditor,
    renderBottomBarEditor,
    renderFooterEditor,
  };
}

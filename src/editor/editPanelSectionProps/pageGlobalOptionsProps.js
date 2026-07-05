export function createPageGlobalOptionsProps({ page, selection, updateTheme, toggleVisible, renderTopNavEditor, renderBottomBarEditor, renderFooterEditor }) {
  return {
    page,
    topNavBlock: selection.topNavBlock,
    bottomBlock: selection.bottomBlock,
    footerBlock: selection.footerBlock,
    hideTopNavControl: selection.hideTopNavControl,
    openId: selection.fixedOpenId,
    updateTheme,
    toggleVisible,
    toggleBlockOpen: selection.toggleBlockOpen,
    renderTopNavEditor,
    renderBottomBarEditor,
    renderFooterEditor,
  };
}
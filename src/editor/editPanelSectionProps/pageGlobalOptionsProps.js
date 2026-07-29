export function createPageGlobalOptionsProps({ page, selection, updatePage, updateTheme, toggleVisible, renderTopNavEditor, renderBottomBarEditor, renderFooterEditor }) {
  return {
    page,
    topNavBlock: selection.topNavBlock,
    bottomBlock: selection.bottomBlock,
    footerBlock: selection.footerBlock,
    hideTopNavControl: selection.hideTopNavControl,
    openId: selection.fixedOpenId,
    updateTheme,
    updatePage,
    toggleVisible,
    toggleBlockOpen: selection.toggleBlockOpen,
    renderTopNavEditor,
    renderBottomBarEditor,
    renderFooterEditor,
  };
}
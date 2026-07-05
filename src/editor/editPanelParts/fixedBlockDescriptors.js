import { createFixedBlockDescriptorCatalog } from './fixedBlockDescriptorCatalog.js';

export function createFixedBlockDescriptors({
  topNavBlock,
  bottomBlock,
  footerBlock,
  hideTopNavControl,
  openId,
  toggleVisible,
  toggleBlockOpen,
  renderTopNavEditor,
  renderBottomBarEditor,
  renderFooterEditor,
}) {
  return createFixedBlockDescriptorCatalog({
    topNavBlock,
    bottomBlock,
    footerBlock,
    hideTopNavControl,
    renderTopNavEditor,
    renderBottomBarEditor,
    renderFooterEditor,
  }).map((descriptor) => ({
    ...descriptor,
    open: openId === descriptor.block.id,
    onToggleOpen: () => toggleBlockOpen(descriptor.block.id),
    onToggleVisible: () => toggleVisible(descriptor.block.id),
  }));
}
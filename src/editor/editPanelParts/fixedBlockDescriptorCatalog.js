import { T } from './editorLabels.js';

export function createFixedBlockDescriptorCatalog({
  topNavBlock,
  bottomBlock,
  footerBlock,
  hideTopNavControl,
  renderTopNavEditor,
  renderBottomBarEditor,
  renderFooterEditor,
}) {
  return [
    !hideTopNavControl && {
      key: 'topnav',
      block: topNavBlock,
      className: 'topnav-fixed-card',
      title: T.topMenu,
      badge: T.topMenuBadge,
      renderEditor: renderTopNavEditor,
    },
    {
      key: 'bottom',
      block: bottomBlock,
      className: 'bottom-cta-card',
      title: T.bottomCta,
      badge: T.bottomCtaBadge,
      renderEditor: renderBottomBarEditor,
    },
    {
      key: 'footer',
      block: footerBlock,
      className: 'footer-fixed-card',
      title: T.footer,
      badge: T.footerBadge,
      renderEditor: renderFooterEditor,
    },
  ].filter(Boolean).filter(({ block }) => block);
}
import React from 'react';
import { AnimationOptionsCard } from './AnimationOptionsCard.jsx';
import { GlobalFixedBlocks } from './GlobalFixedBlocks.jsx';
import { ShareOptionsCard } from './ShareOptionsCard.jsx';

export function PageGlobalOptionsList({
  page,
  topNavBlock,
  bottomBlock,
  footerBlock,
  hideTopNavControl,
  openId,
  updateTheme,
  updatePage,
  toggleVisible,
  toggleBlockOpen,
  renderTopNavEditor,
  renderBottomBarEditor,
  renderFooterEditor,
}) {
  return (
    <div className="page-global-options-list page-global-grid">
      <AnimationOptionsCard page={page} updateTheme={updateTheme} />
      <ShareOptionsCard page={page} updatePage={updatePage} />

      <GlobalFixedBlocks
        topNavBlock={topNavBlock}
        bottomBlock={bottomBlock}
        footerBlock={footerBlock}
        hideTopNavControl={hideTopNavControl}
        openId={openId}
        toggleVisible={toggleVisible}
        toggleBlockOpen={toggleBlockOpen}
        renderTopNavEditor={renderTopNavEditor}
        renderBottomBarEditor={renderBottomBarEditor}
        renderFooterEditor={renderFooterEditor}
      />
    </div>
  );
}
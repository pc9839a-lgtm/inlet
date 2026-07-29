import React from 'react';
import { PageGlobalOptionsHeader } from './PageGlobalOptionsHeader.jsx';
import { PageGlobalOptionsList } from './PageGlobalOptionsList.jsx';

export function PageGlobalOptions({
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
    <section className="card page-global-options-card">
      <PageGlobalOptionsHeader />
      <PageGlobalOptionsList
        page={page}
        topNavBlock={topNavBlock}
        bottomBlock={bottomBlock}
        footerBlock={footerBlock}
        hideTopNavControl={hideTopNavControl}
        openId={openId}
        updateTheme={updateTheme}
        updatePage={updatePage}
        toggleVisible={toggleVisible}
        toggleBlockOpen={toggleBlockOpen}
        renderTopNavEditor={renderTopNavEditor}
        renderBottomBarEditor={renderBottomBarEditor}
        renderFooterEditor={renderFooterEditor}
      />
    </section>
  );
}
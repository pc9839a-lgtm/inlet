import React from 'react';
import './PageGlobalOptions.css';
import { PageGlobalOptionsHeader } from './PageGlobalOptionsHeader.jsx';
import { PageGlobalOptionsList } from './PageGlobalOptionsList.jsx';

export function PageGlobalOptions({ page, updateTheme, updatePage, showTitle = true }) {
  return (
    <section className="card page-global-options-card">
      {showTitle && <PageGlobalOptionsHeader />}
      <PageGlobalOptionsList
        page={page}
        updateTheme={updateTheme}
        updatePage={updatePage}
      />
    </section>
  );
}

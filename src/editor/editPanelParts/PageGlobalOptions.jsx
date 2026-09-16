import React from 'react';
import './PageGlobalOptions.css';
import { PageGlobalOptionsHeader } from './PageGlobalOptionsHeader.jsx';
import { PageGlobalOptionsList } from './PageGlobalOptionsList.jsx';

export function PageGlobalOptions({ page, updateTheme, updatePage }) {
  return (
    <section className="card page-global-options-card">
      <PageGlobalOptionsHeader />
      <PageGlobalOptionsList
        page={page}
        updateTheme={updateTheme}
        updatePage={updatePage}
      />
    </section>
  );
}

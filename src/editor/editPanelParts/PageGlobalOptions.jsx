import React from 'react';
import './PageGlobalOptions.css';
import { PageGlobalOptionsList } from './PageGlobalOptionsList.jsx';

export function PageGlobalOptions({ page, updateTheme, updatePage }) {
  return (
    <section className="page-global-options-card" aria-label="페이지 동작">
      <PageGlobalOptionsList
        page={page}
        updateTheme={updateTheme}
        updatePage={updatePage}
      />
    </section>
  );
}

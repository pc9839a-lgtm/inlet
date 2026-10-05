import React from 'react';
import { NAV } from '../../builder/navigation.js';

export function WorkspaceTabs({ allowedTabs, tab, changeTab }) {
  return (
    <nav className="top-tabs" aria-label="작업 메뉴">
      {NAV.filter(([key]) => allowedTabs.includes(key)).map(([key, label, Icon]) => (
        <button
          key={key}
          className={tab === key ? 'active' : ''}
          type="button"
          aria-current={tab === key ? 'page' : undefined}
          onClick={() => changeTab(key)}
        >
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
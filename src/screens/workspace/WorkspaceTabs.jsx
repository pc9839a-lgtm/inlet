import React from 'react';
import { NAV } from '../../builder/navigation.js';

export function WorkspaceTabs({ allowedTabs, tab, changeTab }) {
  return (
    <nav className="top-tabs">
      {NAV.filter(([key]) => allowedTabs.includes(key)).map(([key, label, Icon]) => (
        <button key={key} className={tab === key ? 'active' : ''} type="button" onClick={() => changeTab(key)}>
          <Icon size={17} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
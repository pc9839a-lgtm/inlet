import React, { useMemo, useRef } from 'react';
import { NAV } from '../../builder/navigation.js';

export function WorkspaceTabs({ allowedTabs, tab, changeTab }) {
  const tabRefs = useRef(new Map());
  const items = useMemo(
    () => NAV.filter(([key]) => allowedTabs.includes(key)),
    [allowedTabs],
  );

  const focusTab = (index) => {
    if (!items.length) return;
    const normalized = ((index % items.length) + items.length) % items.length;
    const [nextKey] = items[normalized];
    tabRefs.current.get(nextKey)?.focus();
  };

  const onKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') return focusTab(0);
    if (event.key === 'End') return focusTab(items.length - 1);
    focusTab(index + (event.key === 'ArrowRight' ? 1 : -1));
  };

  return (
    <div className="top-tabs" role="tablist" aria-label="작업 메뉴">
      {items.map(([key, label, Icon], index) => {
        const active = tab === key;
        return (
          <button
            key={key}
            ref={(node) => {
              if (node) tabRefs.current.set(key, node);
              else tabRefs.current.delete(key);
            }}
            id={`workspace-tab-${key}`}
            className={active ? 'active' : ''}
            type="button"
            role="tab"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            aria-controls={`workspace-panel-${key}`}
            onClick={() => changeTab(key)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

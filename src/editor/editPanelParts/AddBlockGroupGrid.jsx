import React from 'react';
import { ADD_GROUPS } from './editorLabels.js';
import { getAddableBlocksByCategory } from './addBlockCatalog.js';
import { AddBlockGroup } from './AddBlockGroup.jsx';

function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, '');
}

function filteredItems(category, label, query) {
  const normalizedQuery = normalizeSearch(query);
  return getAddableBlocksByCategory(category).filter(([type, meta]) => {
    if (!normalizedQuery) return true;
    const haystack = normalizeSearch([type, meta?.label, meta?.badge, label].filter(Boolean).join(' '));
    return haystack.includes(normalizedQuery);
  });
}

export function AddBlockGroupGrid({ onAdd, query = '', category = 'all' }) {
  const groups = ADD_GROUPS
    .filter(([categoryKey]) => category === 'all' || categoryKey === category)
    .map(([categoryKey, label]) => ({
      category: categoryKey,
      label,
      items: filteredItems(categoryKey, label, query),
    }))
    .filter(({ items }) => items.length > 0);

  if (!groups.length) {
    return <div className="widget-add-empty" role="status">조건에 맞는 위젯이 없습니다.</div>;
  }

  return (
    <div className="widget-group-grid">
      {groups.map(({ category: categoryKey, label, items }) => (
        <AddBlockGroup
          key={categoryKey}
          label={label}
          items={items}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

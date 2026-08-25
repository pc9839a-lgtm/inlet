import React, { useState } from 'react';
import { AddBlockGroupGrid } from './AddBlockGroupGrid.jsx';

export function AddBlockPanel({ onAdd }) {
  const [query, setQuery] = useState('');

  return (
    <div className="add-panel">
      <div className="widget-search">
        <label htmlFor="pagero-widget-search">위젯 찾기</label>
        <input
          id="pagero-widget-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="텍스트, 이미지, 동영상…"
          autoComplete="off"
        />
      </div>
      <AddBlockGroupGrid onAdd={onAdd} query={query} />
    </div>
  );
}

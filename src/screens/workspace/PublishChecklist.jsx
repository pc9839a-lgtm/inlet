import React, { useMemo } from 'react';
import { buildPublishChecklist } from '../../editor/publishChecklist.js';

export default function PublishChecklist({ page }) {
  const checklist = useMemo(() => buildPublishChecklist(page), [page]);

  return (
    <details className={`publish-checklist ${checklist.ready ? 'ready' : ''}`}>
      <summary>
        <span>발행</span>
        <strong>{checklist.readyCount}/{checklist.total}</strong>
      </summary>
      <div className="publish-checklist-popover">
        {checklist.items.map((item) => (
          <span key={item.id} className={item.ok ? 'done' : 'missing'}>
            <b aria-hidden="true">{item.ok ? '✓' : '•'}</b>
            {item.label}
          </span>
        ))}
      </div>
    </details>
  );
}

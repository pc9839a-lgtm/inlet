import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';

export function EditorList({ items = [], getTitle, getIcon, getBadge, renderItem, onAdd, onRemove, addLabel = '항목 추가', emptyText = '아직 추가된 항목이 없습니다.' }) {
  const [openId, setOpenId] = useState('');
  const previousLength = useRef(items.length);

  useEffect(() => {
    if (items.length > previousLength.current) setOpenId(items.at(-1)?.id || '');
    previousLength.current = items.length;
  }, [items]);

  useEffect(() => {
    if (openId && !items.some((item) => item.id === openId)) setOpenId('');
  }, [items, openId]);

  return (
    <div className="editor-list-v2">
      <div className="editor-list-v2-items">
        {items.length === 0 && <p className="editor-list-v2-empty">{emptyText}</p>}
        {items.map((item, index) => {
          const open = openId === item.id;
          const icon = getIcon?.(item, index) ?? index + 1;
          const title = getTitle?.(item, index) || `항목 ${index + 1}`;
          const badge = getBadge?.(item, index);

          return (
            <section key={item.id} className={`editor-list-item-v2 ${open ? 'is-open' : ''}`}>
              <div className="editor-list-item-v2-header">
                <button type="button" className="editor-list-item-v2-trigger" aria-expanded={open} onClick={() => setOpenId(open ? '' : item.id)}>
                  <span className="editor-list-item-v2-icon" aria-hidden="true">{icon}</span>
                  <strong>{title}</strong>
                  {badge && <em>{badge}</em>}
                  <ChevronDown size={17} aria-hidden="true" />
                </button>
                <button type="button" className="editor-list-item-v2-remove" aria-label={`${title} 삭제`} title={`${title} 삭제`} onClick={() => onRemove(item)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              {open && <div className="editor-list-item-v2-body">{renderItem(item, index)}</div>}
            </section>
          );
        })}
      </div>
      <button type="button" className="editor-list-v2-add" onClick={onAdd}>
        <Plus size={17} aria-hidden="true" />
        <span>{addLabel}</span>
      </button>
    </div>
  );
}

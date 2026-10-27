import React from 'react';
import { Pencil, Pin } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { ScreenOrderRowVisibility } from './ScreenOrderRowVisibility.jsx';
import { FixedBlockCardBody } from './FixedBlockCardBody.jsx';
import { FixedBlockCardHeader } from './FixedBlockCardHeader.jsx';

export function FixedBlockCard({
  block, className, title, badge, renderEditor, open, onToggleOpen, onToggleVisible,
  compositionRow = false, selected = false,
}) {
  if (!block) return null;

  if (compositionRow) {
    const Icon = META[block.type]?.icon;
    const visible = block.visible !== false;
    return (
      <div
        id={`editor-block-${block.id}`}
        className={`fixed-block-card fixed-composition-row ${className}${selected ? ' is-selected' : ''}${visible ? '' : ' is-hidden'}`}
        data-selected={selected ? 'true' : 'false'}
        data-fixed-position="true"
      >
        <div className="fixed-block-head screen-order-v2-head">
          <span className="fixed-composition-anchor" aria-label="위치 고정" title="위치 고정">
            <Pin size={14} aria-hidden="true" />
          </span>
          <button
            type="button"
            className="screen-order-v2-title-wrap fixed-composition-select"
            onClick={onToggleOpen}
            aria-pressed={selected}
            aria-label={`${title} 설정 선택`}
          >
            <span className="screen-order-v2-type-icon" aria-hidden="true">{Icon && <Icon size={16} />}</span>
            <span className="screen-order-v2-identity-copy">
              <strong>{title}</strong>
              {!visible && <small className="screen-order-v2-identity-detail">숨김</small>}
            </span>
          </button>
          <ScreenOrderRowVisibility visible={visible} onToggleVisible={onToggleVisible} />
          <button
            type="button"
            className="screen-order-v2-action fixed-open-button"
            onClick={onToggleOpen}
            aria-pressed={selected}
            aria-label={`${title} 편집`}
            title="편집"
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section id={`editor-block-${block.id}`} className={`fixed-block-card ${className} ${open ? 'open selected' : ''}`}>
      <FixedBlockCardHeader
        title={title}
        badge={badge}
        visible={block.visible}
        open={open}
        onToggleOpen={onToggleOpen}
        onToggleVisible={onToggleVisible}
      />
      {open && <FixedBlockCardBody block={block} renderEditor={renderEditor} />}
    </section>
  );
}

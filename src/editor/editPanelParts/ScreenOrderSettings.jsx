import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';

export function ScreenOrderSettings({ block, identity, onBack, renderBlockEditor }) {
  const backRef = React.useRef(null);
  const metaType = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;
  const meta = META[metaType] || META.text;
  const typeLabel = `${meta.label}${identity?.repeated ? ` ${identity.occurrence}` : ''}`;
  const title = identity?.customLabel || identity?.detail || typeLabel;

  React.useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="screen-order-v2-settings-view">
      <header className="screen-order-v2-settings-header">
        <button ref={backRef} className="screen-order-v2-settings-back" type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          블록 목록
        </button>
        <div className="screen-order-v2-settings-title">
          <h2 title={title}>{title}</h2>
          <span>{typeLabel}{!block.visible ? ' · 숨김' : ''}</span>
        </div>
      </header>
      <div
        id={`editor-block-settings-${block.id}`}
        className="screen-order-v2-settings"
        data-block-settings-id={block.id}
        data-scroll-region="block-settings"
        role="region"
        tabIndex={0}
        aria-label={`${meta.label} 상세 설정`}
      >
        {renderBlockEditor(block)}
      </div>
    </div>
  );
}

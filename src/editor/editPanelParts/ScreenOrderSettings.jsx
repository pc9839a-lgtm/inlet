import React from 'react';
import { META } from '../../config/blockMeta.jsx';

export function ScreenOrderSettings({ block, identity, renderBlockEditor }) {
  const backRef = React.useRef(null);
  const metaType = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;
  const meta = META[metaType] || META.text;
  const typeLabel = `${meta.label}${identity?.repeated ? ` ${identity.occurrence}` : ''}`;
  const title = identity?.customLabel || typeLabel;

  React.useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="screen-order-v2-settings-view">
      <header className="screen-order-v2-settings-header">
        <div className="screen-order-v2-settings-title">
          <h2 ref={backRef} tabIndex={-1} title={title}>{title}</h2>
          {!block.visible && <span className="screen-order-settings-hidden">숨김</span>}
        </div>
      </header>
      <div
        id={`editor-block-settings-${block.id}`}
        className="screen-order-v2-settings"
        data-block-settings-id={block.id}
        data-scroll-region="block-settings"
        role="group"
        aria-label={`${meta.label} 상세 설정`}
      >
        {renderBlockEditor(block)}
      </div>
    </div>
  );
}

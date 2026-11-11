import React from 'react';
import { META } from '../../config/blockMeta.jsx';
import { InspectorBlockSwitch } from './InspectorBlockSwitch.jsx';
import { isExplicitlyHidden } from './screenOrderIdentityModel.js';

// The selected block edits in place, just below its row. Its type and label
// are the only visual hierarchy before the existing editor fields.
export function ScreenOrderSettings({ block, identity, renderBlockEditor, actions, navigation }) {
  const metaType = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;
  const meta = META[metaType] || META.text;
  const title = identity?.customLabel || identity?.contentTitle || meta.label;
  const Icon = meta.icon;

  return (
    <div className="screen-order-v2-settings-view">
      <header className="screen-order-v2-settings-header">
        <div className="screen-order-v2-settings-title">
          <span className="editor-inspector-kind-icon"><Icon size={17} aria-hidden="true" /></span>
          <div className="editor-inspector-selected-copy">
            <span className="editor-inspector-section-label">편집 중</span>
            <h2 tabIndex={-1} title={title}>{title}</h2>
          </div>
          {isExplicitlyHidden(block) && <span className="screen-order-settings-hidden">숨김</span>}
          {actions}
        </div>
        <InspectorBlockSwitch navigation={navigation} />
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

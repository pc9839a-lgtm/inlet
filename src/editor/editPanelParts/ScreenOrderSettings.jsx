import React from 'react';
import { META } from '../../config/blockMeta.jsx';
import { InspectorBlockSwitch } from './InspectorBlockSwitch.jsx';
import { isExplicitlyHidden } from './screenOrderIdentityModel.js';

// Direct section shortcuts reuse each widget's existing content/design
// controls; there is no duplicated editor state or extra settings panel.
const DESIGN_SECTION = {
  hero: '.hero-editor-design',
  text: '.text-editor-design',
  image: '.image-editor-more',
  form: '.form-design-detail',
};


// The selected block edits in a dedicated inspector; its real fields and
// existing disclosure state remain shared with the live page.
export function ScreenOrderSettings({ block, identity, renderBlockEditor, actions, navigation }) {
  const metaType = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;
  const meta = META[metaType] || META.text;
  const title = identity?.customLabel || identity?.contentTitle || meta.label;
  const Icon = meta.icon;
  const designSelector = DESIGN_SECTION[block.type];
  const jumpToSection = (section) => {
    const settings = document.getElementById(`editor-block-settings-${block.id}`);
    const scroller = settings?.closest('.editor-properties-content');
    if (!scroller) return;
    if (section === 'content') {
      // Return to the inspector heading and the first editable fields.
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const destination = settings.querySelector(designSelector);
    if (!destination) return;
    if (section === 'design' && !destination.open) {
      destination.querySelector('summary')?.click();
    }
    requestAnimationFrame(() => {
      const viewport = scroller.getBoundingClientRect();
      const bounds = destination.getBoundingClientRect();
      scroller.scrollTo({
        top: Math.max(0, scroller.scrollTop + bounds.top - viewport.top - 12),
        behavior: 'smooth',
      });
      if (section === 'design') destination.querySelector('summary')?.focus({ preventScroll: true });
    });
  };


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
        {designSelector && (
          <div className="editor-inspector-jump" role="group" aria-label="설정 바로가기">
            <button type="button" aria-controls={`editor-block-settings-${block.id}`}
              onClick={() => jumpToSection('content')}>내용</button>
            <button type="button" aria-controls={`editor-block-settings-${block.id}`}
              onClick={() => jumpToSection('design')}>디자인</button>
          </div>
        )}
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

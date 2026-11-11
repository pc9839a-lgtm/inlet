import React from 'react';
import { META } from '../../config/blockMeta.jsx';
import { InspectorBlockSwitch } from './InspectorBlockSwitch.jsx';
import { isExplicitlyHidden } from './screenOrderIdentityModel.js';

export function ScreenOrderSettings({ block, identity, renderBlockEditor, actions, navigation }) {
  const backRef = React.useRef(null);
  const metaType = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;
  const meta = META[metaType] || META.text;
  const typeLabel = `${meta.label}${identity?.repeated ? ` ${identity.occurrence}` : ''}`;
  const title = identity?.customLabel || typeLabel;
  const Icon = meta.icon;
  // Keep the selected item recognizable, but make its immediately editable
  // content the visual priority. No new fields or alternate save path.
  const selectedContext = ({
    text: '내용과 디자인',
    image: '사진과 표시 방식',
    form: '질문과 제출 버튼',
    code: 'HTML 코드 직접 편집',
  })[block.type] || '내용과 설정';
  const primaryLabel = ({
    text: '내용 수정',
    image: '사진 변경',
    form: '문의 폼 편집',
    code: '코드 편집',
  })[block.type] || '내용 수정';

  React.useEffect(() => {
    // A user-selected row/canvas may move focus into its inspector.
    // On first entry or when returning from Inbox/Stats, leave the active
    // workspace navigation trigger focused instead of stealing its focus.
    const active = document.activeElement;
    if (active?.closest?.('.editor-composition-panel, .preview-workspace')) {
      backRef.current?.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="screen-order-v2-settings-view">
      <header className="screen-order-v2-settings-header">
        <div className="editor-inspector-section-label">선택한 블록</div>
        <div className="screen-order-v2-settings-title">
          <span className="editor-inspector-kind-icon"><Icon size={18} aria-hidden="true" /></span>
          <div className="editor-inspector-selected-copy">
            <h2 ref={backRef} tabIndex={-1} title={title}>{title}</h2>
            <span className="editor-inspector-selected-context" title={identity?.contentTitle || selectedContext}>{identity?.contentTitle || selectedContext}</span>
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
        <h3 className="inspector-primary-heading">{primaryLabel}</h3>
        {renderBlockEditor(block)}
      </div>
    </div>
  );
}

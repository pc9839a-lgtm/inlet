import React from 'react';
import { ChevronDown } from 'lucide-react';
import { SegmentedControl } from '../ui/index.js';
import { Switch } from './editorControls.jsx';
import './ShareOptionsCard.css';

const SHARE_POSITION_OPTIONS = [
  { value: 'top-left', label: '좌측 상단' },
  { value: 'top-right', label: '우측 상단' },
  { value: 'bottom-left', label: '좌측 하단' },
  { value: 'bottom-right', label: '우측 하단' },
];

function safeSharePosition(value) {
  return SHARE_POSITION_OPTIONS.some((option) => option.value === value) ? value : 'top-right';
}

export function ShareOptionsCard({ page, updatePage }) {
  const [expanded, setExpanded] = React.useState(false);
  const panelId = React.useId();
  const enabled = page.share?.enabled !== false;
  const position = safeSharePosition(page.share?.position);
  const updateShare = (patch) => updatePage({
    share: {
      ...(page.share || {}),
      position,
      display: 'icon',
      ...patch,
    },
  });

  return (
    <section className="edit-animation-card share-options-card">
      <div className="block-head fixed-block-head edit-animation-head share-options-head page-option-head">
        <div className="fixed-block-copy">
          <strong>공유 버튼</strong>
        </div>
        <Switch
          checked={enabled}
          onChange={(event) => {
            updateShare({ enabled: event.target.checked });
            setExpanded(event.target.checked);
          }}
          label="공유 버튼 표시"
        />
        <button type="button" className="page-option-expand" disabled={!enabled} aria-expanded={enabled && expanded} aria-controls={panelId} aria-label={`공유 버튼 ${expanded ? '접기' : '설정 보기'}`} onClick={() => setExpanded((value) => !value)}>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {enabled && (
        <div id={panelId} className="share-position-control" hidden={!expanded}>
          <SegmentedControl
            label="위치"
            value={position}
            onChange={(value) => updateShare({ position: safeSharePosition(value) })}
            options={SHARE_POSITION_OPTIONS}
          />
        </div>
      )}
    </section>
  );
}

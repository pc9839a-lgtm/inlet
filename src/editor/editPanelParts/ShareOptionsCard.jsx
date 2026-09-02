import React from 'react';
import { Share2 } from 'lucide-react';
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
      <div className="block-head fixed-block-head edit-animation-head share-options-head">
        <div className="fixed-block-copy">
          <Share2 size={17} aria-hidden="true" />
          <strong>공유</strong>
        </div>
        <Switch
          checked={enabled}
          onChange={(event) => updateShare({ enabled: event.target.checked })}
          label="공유 버튼 표시"
        />
      </div>
      {enabled && (
        <div className="share-position-control">
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

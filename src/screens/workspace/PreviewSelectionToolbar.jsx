import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { META } from '../../config/blockMeta.jsx';
import { createScreenOrderIdentities } from '../../editor/editPanelParts/screenOrderIdentityModel.js';
import { canDuplicateScreenOrderBlock } from '../../editor/editPanelParts/screenOrderActionPolicy.js';
import { createScreenOrderMovement } from '../../editor/editPanelParts/screenOrderMovement.js';

// The selection tools live in the STAGE above the phone, never in the page.
// No position/scroll measurement is needed, so hero headings, form fields and
// the fixed CTA remain fully readable at 75, 100 and 125 percent preview zoom.
export function PreviewSelectionToolbar({ page, selectedBlockId, actions }) {
  const blocks = page?.blocks || [];
  const selectedIndex = blocks.findIndex(item => item.id === selectedBlockId);
  const block = selectedIndex >= 0 ? blocks[selectedIndex] : null;
  const normal = blocks.filter(item => !['topnav', 'bottombar', 'footer'].includes(item.type));
  const index = normal.findIndex(item => item.id === selectedBlockId);
  const movement = block ? createScreenOrderMovement({
    block, index, total: normal.length, reorderToIndex: actions?.reorderToIndex,
  }) : null;
  if (!block || !actions?.toggleVisible) return null;

  const identity = createScreenOrderIdentities(blocks)[selectedIndex];
  const kind = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;
  const typeLabel = META[kind]?.label || '블록';
  const label = identity?.customLabel || `${typeLabel}${identity?.repeated ? ` ${identity.occurrence}` : ''}`;
  const details = identity?.detail ? `${label} · ${identity.detail}` : label;
  const hidden = block.visible === false;

  return (
    <div
      className="preview-selection-toolbar"
      role="toolbar"
      aria-label={`선택 블록 작업: ${label}`}
      data-selected-block-id={block.id}
      data-preview-hidden={hidden ? 'true' : 'false'}
    >
      <span className="preview-selection-identity" title={details}>
        <strong>{label}</strong>
        {hidden && <small>숨김</small>}
      </span>
      <div className="preview-selection-actions">
        {index >= 0 && canDuplicateScreenOrderBlock(block) && (
          <button type="button" aria-label="블록 복제" title="복제" onClick={() => actions.duplicateBlock(block.id)}>
            <Copy size={15} aria-hidden="true" /><span>복제</span>
          </button>
        )}
        <button
          type="button"
          aria-label={hidden ? '블록 표시' : '블록 숨기기'}
          title={hidden ? '블록 표시' : '블록 숨기기'}
          onClick={() => actions.toggleVisible(block.id)}
        >
          {hidden ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
          <span>{hidden ? '표시' : '숨김'}</span>
        </button>
        {index >= 0 && (
          <>
            <button type="button" aria-label="블록 위로 이동" title="위로 이동" disabled={!movement.canMoveUp} onClick={movement.moveUp}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label="블록 아래로 이동" title="아래로 이동" disabled={!movement.canMoveDown} onClick={movement.moveDown}>
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button type="button" aria-label="블록 삭제" title="블록 삭제" onClick={() => actions.removeBlock(block.id)}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

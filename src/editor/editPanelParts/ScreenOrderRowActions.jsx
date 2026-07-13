import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { canDuplicateScreenOrderBlock } from './screenOrderActionPolicy.js';
import { T } from './editorLabels.js';
import { IconAction } from './editorControls.jsx';
import { stop } from './editorEvents.js';

export function ScreenOrderRowActions({
  block,
  meta,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) {
  const canDuplicate = canDuplicateScreenOrderBlock(block);

  return (
    <div className="screen-row-actions" onClick={stop}>
      <IconAction
        onClick={onMoveUp}
        title={T.moveUp}
        aria-label={`${meta.label} ${T.moveUp}`}
        disabled={!canMoveUp}
      >
        <ArrowUp size={16} />
      </IconAction>
      <IconAction
        onClick={onMoveDown}
        title={T.moveDown}
        aria-label={`${meta.label} ${T.moveDown}`}
        disabled={!canMoveDown}
      >
        <ArrowDown size={16} />
      </IconAction>
      <IconAction
        onClick={onDuplicate}
        title={T.copy}
        aria-label={`${meta.label} ${T.copy}`}
        disabled={!canDuplicate}
      >
        <Copy size={16} />
      </IconAction>
      <IconAction
        className="screen-delete-action"
        onClick={onRemove}
        title={T.delete}
        aria-label={`${meta.label} ${T.delete}`}
      >
        <Trash2 size={16} />
      </IconAction>
    </div>
  );
}

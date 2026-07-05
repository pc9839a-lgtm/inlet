import { T } from './editorLabels.js';

export function createScreenOrderRowMenuItems({
  canMoveUp,
  canMoveDown,
  canDuplicate,
  onOpenSettings,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}) {
  return [
    { key: 'settings', label: T.settings, handler: onOpenSettings },
    { key: 'move-up', label: T.moveUp, handler: onMoveUp, disabled: !canMoveUp },
    { key: 'move-down', label: T.moveDown, handler: onMoveDown, disabled: !canMoveDown },
    { key: 'copy', label: T.copy, handler: onDuplicate, hidden: !canDuplicate },
    { key: 'delete', label: T.delete, handler: onRemove, danger: true },
  ].filter((item) => !item.hidden);
}
import { META } from '../../config/blockMeta.jsx';
import { createScreenOrderControls } from './screenOrderControls.js';

export function createScreenOrderItemModel({
  block,
  index,
  total,
  dragId,
  setDragId,
  reorderToIndex,
}) {
  const metaType = block.s?.widgetMode === 'youtube' ? 'youtube' : block.type;

  return {
    meta: META[metaType] || META.text,
    controls: createScreenOrderControls({
      block,
      index,
      total,
      dragId,
      setDragId,
      reorderToIndex,
    }),
    isLast: index === total - 1,
  };
}

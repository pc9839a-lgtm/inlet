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
  return {
    meta: META[block.type] || META.text,
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
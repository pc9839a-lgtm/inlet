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
  const meta = block.type === 'code' && block.s?.widgetMode === 'bgm'
    ? META.bgm
    : (META[block.type] || META.text);

  return {
    meta,
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
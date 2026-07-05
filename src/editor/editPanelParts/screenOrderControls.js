import { createScreenOrderDragDrop } from './screenOrderDragDrop.js';
import { createScreenOrderMovement } from './screenOrderMovement.js';

export function createScreenOrderControls({ block, index, total, dragId, setDragId, reorderToIndex }) {
  return {
    ...createScreenOrderMovement({ block, index, total, reorderToIndex }),
    ...createScreenOrderDragDrop({ block, index, total, dragId, setDragId, reorderToIndex }),
  };
}

export function createScreenOrderMovement({ block, index, total, reorderToIndex }) {
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;

  const moveUp = (event) => {
    event.stopPropagation();
    if (canMoveUp) reorderToIndex(block.id, index - 1);
  };

  const moveDown = (event) => {
    event.stopPropagation();
    if (canMoveDown) reorderToIndex(block.id, index + 2);
  };

  return {
    canMoveUp,
    canMoveDown,
    moveUp,
    moveDown,
  };
}

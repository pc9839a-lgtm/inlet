export function createScreenOrderDragDrop({ block, index, total, dragId, setDragId, reorderToIndex }) {
  const dragStart = (event) => {
    event.stopPropagation();
    setDragId(block.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', block.id);
  };

  const activateDrop = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const from = event.dataTransfer.getData('text/plain') || dragId;
    if (from && from !== block.id) event.currentTarget.classList.add('active');
  };

  const clearDrop = (event) => {
    event.currentTarget.classList.remove('active');
  };

  const dropAt = (targetIndex) => (event) => {
    event.preventDefault();
    event.currentTarget.classList.remove('active');
    const from = event.dataTransfer.getData('text/plain') || dragId;
    if (!from) return;
    reorderToIndex(from, targetIndex);
    setDragId('');
  };

  return {
    dragStart,
    dragEnd: () => setDragId(''),
    activateDrop,
    clearDrop,
    dropBefore: dropAt(index),
    dropAfter: dropAt(total),
  };
}

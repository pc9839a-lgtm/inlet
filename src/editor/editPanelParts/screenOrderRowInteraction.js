import { isActivationKey } from './editorEvents.js';

export function createScreenOrderRowInteraction({ onSelectRow }) {
  const selectRow = () => {
    onSelectRow?.();
  };

  const selectRowByKey = (event) => {
    if (!isActivationKey(event)) return;
    event.preventDefault();
    selectRow();
  };

  return {
    selectRow,
    selectRowByKey,
  };
}
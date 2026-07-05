import { normalizeButtons } from '../../lib/blockButtons.js';
import { visibleBottomButtons } from './bottomBarEditorModel.js';

export function useBottomBarButtons(s, set) {
  const count = Math.max(1, Math.min(3, Number(s.count || 1)));
  const buttons = normalizeButtons(s.buttons, count);

  const updateButton = (idx, patch) => {
    const next = normalizeButtons(s.buttons, count);
    next[idx] = { ...next[idx], ...patch };
    set({ buttons: next });
  };

  const setCount = (value) => {
    const nextCount = Number(value);
    set({ count: nextCount, buttons: normalizeButtons(buttons, nextCount) });
  };

  return {
    count,
    buttons: visibleBottomButtons(buttons, count),
    updateButton,
    setCount,
  };
}
import { normalizeButtons } from '../../lib/blockButtons.js';
import { normalizeTarget } from '../targetControlModel.js';

export const BOTTOM_EMOJIS = ['💬','📅','📞','🔗','🏠','📍','💳','🎁','⭐','📝','✅','🚀','💡','📦','🛒','👤'];

export function normalizeBottomTarget(target, blocks = []) {
  return normalizeTarget(target, blocks);
}

export function visibleBottomButtons(buttons, count) {
  return normalizeButtons(buttons, count).slice(0, count);
}

import { normalizeButtons } from '../../lib/blockButtons.js';

export const BOTTOM_EMOJIS = ['💬','📅','📞','🔗','🏠','📍','💳','🎁','⭐','📝','✅','🚀','💡','📦','🛒','👤'];

export function normalizeBottomTarget(target, blocks = []) {
  const raw = String(target || '');
  if (raw.startsWith('block:')) {
    const id = raw.slice(6);
    return blocks.some((b) => b.id === id) ? raw : (blocks[0]?.id ? `block:${blocks[0].id}` : 'hero');
  }
  if (raw === 'url') return raw;
  const matched = blocks.find((b) => b.type === raw);
  return matched?.id ? `block:${matched.id}` : (blocks[0]?.id ? `block:${blocks[0].id}` : raw || 'hero');
}

export function visibleBottomButtons(buttons, count) {
  return normalizeButtons(buttons, count).slice(0, count);
}

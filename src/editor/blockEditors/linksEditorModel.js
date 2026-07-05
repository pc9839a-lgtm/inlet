import { linkThumbnailFromUrl } from '../../lib/linkPreview.js';
import { pickSafe, uid } from '../../lib/pageModel.js';

export const LINK_EMOJIS = ['💬','📅','📞','🔗','🏠','📍','🎁','✅','⭐','🛒','👤'];

export function normalizeLinkItem(item = {}) {
  const url = item.url || '';
  const thumb = item.thumb || linkThumbnailFromUrl(url);
  return {
    id: item.id || uid(),
    emoji: item.emoji ?? '🔗',
    iconMode: pickSafe(item.iconMode || 'emoji', ['none','emoji','thumb'], 'emoji'),
    thumb,
    label: item.label || '새 링크',
    target: item.target || 'url',
    url,
    lastWidgetTarget: item.lastWidgetTarget || '',
  };
}

export function createNewLinkItem() {
  return normalizeLinkItem({ id: uid(), emoji: '🔗', iconMode: 'emoji', label: '새 링크', target: 'url', url: 'https://' });
}
export function updateLinkItem(items, id, patch) {
  return items.map((item) => {
    if (item.id !== id) return item;
    const merged = { ...item, ...patch };
    if (patch.url) merged.url = patch.url;
    return merged;
  });
}
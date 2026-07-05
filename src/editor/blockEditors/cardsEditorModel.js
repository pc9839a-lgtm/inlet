import { uid } from '../../lib/pageModel.js';

export function normalizeCardItems(items) {
  return Array.isArray(items) ? items : [];
}

export function createCardItem(index) {
  return {
    id: uid(),
    eyebrow: String(index + 1).padStart(2, '0'),
    title: '새 카드',
    body: '내용을 입력하세요',
  };
}

export function updateCardItem(items, id, patch) {
  return normalizeCardItems(items).map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeCardItem(items, id) {
  return normalizeCardItems(items).filter((item) => item.id !== id);
}

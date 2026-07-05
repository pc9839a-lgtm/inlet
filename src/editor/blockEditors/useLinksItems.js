import { createNewLinkItem, normalizeLinkItem, updateLinkItem } from './linksEditorModel.js';

export default function useLinksItems({ s, set }) {
  const items = (s.items || []).map(normalizeLinkItem);

  const updateItem = (id, patch) => set({ items: updateLinkItem(items, id, patch) });
  const removeItem = (id) => set({ items: items.filter((item) => item.id !== id) });
  const addItem = () => set({ items: [...items, createNewLinkItem()] });

  return {
    items,
    updateItem,
    removeItem,
    addItem,
  };
}
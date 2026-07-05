import { createDownloadItem, normalizeDownloadItem } from './downloadEditorModel.js';

export function useDownloadItems(s, set) {
  const items = (s.items || []).map(normalizeDownloadItem);

  const updateItem = (id, patch) => set({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const removeItem = (id) => set({ items: items.filter((item) => item.id !== id) });
  const addItem = () => set({ items: [...items, createDownloadItem(items.length)] });

  return { items, updateItem, removeItem, addItem };
}
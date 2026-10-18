import { createDownloadItem, normalizeDownloadItem } from './downloadEditorModel.js';

export function useDownloadItems(s, set) {
  const items = (s.items || []).map(normalizeDownloadItem);

  // Every mutation rebases on the latest block settings, not the render
  // captured when a file upload started.
  const updateItem = (id, patch) => set((current) => {
    const latest = (current.items || []).map(normalizeDownloadItem);
    if (!latest.some((entry) => entry.id === id)) return null;
    return { items: latest.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) };
  });
  const removeItem = (id) => set((current) => ({
    items: (current.items || []).map(normalizeDownloadItem).filter((entry) => entry.id !== id),
  }));
  const addItem = () => set((current) => {
    const latest = (current.items || []).map(normalizeDownloadItem);
    return { items: [...latest, createDownloadItem(latest.length)] };
  });

  return { items, updateItem, removeItem, addItem };
}
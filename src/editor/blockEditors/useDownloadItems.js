import { useRef } from 'react';
import { createDownloadItem, normalizeDownloadItem } from './downloadEditorModel.js';

export function useDownloadItems(s, set) {
  const items = (s.items || []).map(normalizeDownloadItem);
  const latestItemsRef = useRef(items);
  latestItemsRef.current = items;

  // BlockEditor.set accepts a patch object, not a functional updater.
  // Keep one current list for event handlers and delayed upload callbacks.
  const changeItems = (change) => {
    const current = latestItemsRef.current;
    const next = change(current);
    if (next === current) return;
    latestItemsRef.current = next;
    set({ items: next });
  };

  const updateItem = (id, patch) => changeItems((current) => {
    if (!current.some((entry) => entry.id === id)) return current;
    return current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  });
  const removeItem = (id) => changeItems((current) => current.filter((entry) => entry.id !== id));
  const addItem = () => changeItems((current) => [...current, createDownloadItem(current.length)]);

  return { items, updateItem, removeItem, addItem };
}

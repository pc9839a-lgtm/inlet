import { createFaqItem, normalizeFaqItems } from './faqEditorModel.js';

export default function useFaqItems({ s, set }) {
  const items = normalizeFaqItems(s.items);

  const updateItem = (id, patch) => {
    set({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  };

  const removeItem = (id) => {
    set({ items: items.filter((item) => item.id !== id) });
  };

  const addItem = () => {
    set({ items: [...items, createFaqItem(items.length)] });
  };

  return { items, updateItem, removeItem, addItem };
}
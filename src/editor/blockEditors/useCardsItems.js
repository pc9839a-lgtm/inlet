import { createCardItem, normalizeCardItems, removeCardItem, updateCardItem } from './cardsEditorModel.js';

export default function useCardsItems({ s, set }) {
  const items = normalizeCardItems(s.items);

  const changeItem = (id, patch) => set({ items: updateCardItem(items, id, patch) });
  const deleteItem = (id) => set({ items: removeCardItem(items, id) });
  const addItem = () => set({ items: [...items, createCardItem(items.length)] });

  return {
    items,
    changeItem,
    deleteItem,
    addItem,
  };
}
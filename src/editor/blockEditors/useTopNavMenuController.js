import { useState } from 'react';
import { MAX_MENU_COUNT, makeMenu, normalizedTopNavMenus } from './topNavEditorModel.js';

export function useTopNavMenuController(s, set) {
  const [dragId, setDragId] = useState('');
  const [dragOverId, setDragOverId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const menus = normalizedTopNavMenus(s.menus);

  const updateMenu = (id, patch) => set({ menus: menus.map((menu) => (menu.id === id ? { ...menu, ...patch } : menu)) });

  const setMenuCount = (value) => {
    const count = Math.max(1, Math.min(MAX_MENU_COUNT, Number(value) || 1));
    const next = [...menus];
    while (next.length < count) next.push(makeMenu(next.length));
    set({ menus: next.slice(0, count) });
    setOpenMenuId('');
  };

  const removeMenu = (id) => {
    if (menus.length <= 1) return;
    set({ menus: menus.filter((menu) => menu.id !== id) });
    if (openMenuId === id) setOpenMenuId('');
  };

  const moveMenu = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const from = menus.findIndex((menu) => menu.id === dragId);
    const to = menus.findIndex((menu) => menu.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...menus];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ menus: next });
  };

  return {
    menus,
    openMenuId,
    dragId,
    dragOverId,
    setMenuCount,
    setOpenMenuId,
    setDragId,
    setDragOverId,
    updateMenu,
    removeMenu,
    moveMenu,
  };
}
import { useState } from 'react';
import {
  MAX_MENU_COUNT,
  makeMenu,
  normalizedTopNavMenus,
  topNavMenuStorage,
} from './topNavEditorModel.js';

export function useTopNavMenuController(s, set) {
  const [dragId, setDragId] = useState('');
  const [dragOverId, setDragOverId] = useState('');
  const [openMenuId, setOpenMenuId] = useState('');
  const menus = normalizedTopNavMenus(s.menus, s.menusV2);
  const saveMenus = (nextMenus) => set(topNavMenuStorage(nextMenus));

  const updateMenu = (id, patch) => saveMenus(menus.map((menu) => (menu.id === id ? { ...menu, ...patch } : menu)));

  const setMenuCount = (value) => {
    const count = Math.max(1, Math.min(MAX_MENU_COUNT, Number(value) || 1));
    const next = [...menus];
    while (next.length < count) next.push(makeMenu(next.length));
    saveMenus(next.slice(0, count));
    setOpenMenuId('');
  };

  const removeMenu = (id) => {
    if (menus.length <= 1) return;
    saveMenus(menus.filter((menu) => menu.id !== id));
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
    saveMenus(next);
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

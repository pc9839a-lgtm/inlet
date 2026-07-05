export const MAX_MENU_COUNT = 5;

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeMenu(index) {
  return { id: uid(), label: `\uBA54\uB274 ${index + 1}`, target: 'hero', url: '' };
}

export function normalizedTopNavMenus(menus) {
  return Array.isArray(menus) ? menus.slice(0, MAX_MENU_COUNT) : [];
}

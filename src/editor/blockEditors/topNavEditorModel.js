export const LEGACY_MENU_COUNT = 5;
export const MAX_MENU_COUNT = 8;

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeMenu(index) {
  return { id: uid(), label: `메뉴 ${index + 1}`, target: 'hero', url: '' };
}

export function normalizedTopNavMenus(menus, menusV2) {
  const source = Array.isArray(menusV2) && menusV2.length
    ? menusV2
    : (Array.isArray(menus) ? menus : []);
  return source.slice(0, MAX_MENU_COUNT);
}

export function topNavMenuStorage(menus) {
  const normalized = Array.isArray(menus) ? menus.slice(0, MAX_MENU_COUNT) : [];
  return {
    menus: normalized.slice(0, LEGACY_MENU_COUNT),
    menusV2: normalized,
  };
}

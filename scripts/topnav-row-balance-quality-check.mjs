import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [layout, css] = await Promise.all([
  readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8'),
  readFile('src/styles/preview-workspace-topnav-balance.css', 'utf8'),
]);

assert(layout.includes('storedMenus.slice(0, 8)'), 'top navigation must continue rendering up to eight menus');
assert(layout.includes('topnav-menu-count-${menuCount}'), 'top navigation must expose its menu count as a CSS class');
assert(layout.includes("menuCount > 4 ? 'topnav-menu-two-row' : ''"), 'five or more menus must remain in wrapped mode');

assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set'), 'five-menu grid override is missing');
assert(css.includes('.topnav-one-line.topnav-menu-count-6 .top-menu-set'), 'six-menu grid override is missing');
assert(css.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'), 'five and six menus must use a six-unit grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button'), 'five-menu item sizing is missing');
assert(css.includes('grid-column: span 2'), 'five-menu items must stay on a consistent three-column width');
assert(!css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4)'), 'five-menu second row must not be centered or stretched');
assert(css.includes('incomplete rows aligned left'), 'five-menu left-alignment contract comment is missing');

assert(css.includes('.topnav-one-line.topnav-menu-count-7 .top-menu-set'), 'seven-menu grid override is missing');
assert(css.includes('.topnav-one-line.topnav-menu-count-8 .top-menu-set'), 'eight-menu grid override is missing');
assert(css.includes('grid-template-columns: repeat(12, minmax(0, 1fr))'), 'seven and eight menus must use a twelve-unit balancing grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-7 .top-menu-set > button:nth-child(n + 5)'), 'seven-menu second row selector is missing');
assert(css.includes('grid-column: span 4'), 'seven-menu second row must split into three equal cells');

assert(css.includes('min-height: 44px'), 'navigation buttons must preserve the 44px touch target');
assert(css.includes('white-space: normal') && css.includes('overflow-wrap: anywhere'), 'navigation labels must continue wrapping without ellipsis');
assert(!css.includes('overflow-x: auto'), 'top navigation must not reintroduce horizontal scrolling');

console.log(JSON.stringify({
  ok: true,
  rows: {
    5: { distribution: [3, 2], alignment: 'left' },
    6: { distribution: [3, 3], alignment: 'full' },
    7: { distribution: [4, 3], alignment: 'balanced' },
    8: { distribution: [4, 4], alignment: 'full' },
  },
}, null, 2));

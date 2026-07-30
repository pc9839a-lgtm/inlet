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
assert(css.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'), 'five and six menus must use a six-unit balancing grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4)'), 'five-menu second row selector is missing');
assert(css.includes('grid-column: span 3'), 'five-menu second row must split into two equal cells');

assert(css.includes('.topnav-one-line.topnav-menu-count-7 .top-menu-set'), 'seven-menu grid override is missing');
assert(css.includes('.topnav-one-line.topnav-menu-count-8 .top-menu-set'), 'eight-menu grid override is missing');
assert(css.includes('grid-template-columns: repeat(12, minmax(0, 1fr))'), 'seven and eight menus must use a twelve-unit balancing grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-7 .top-menu-set > button:nth-child(n + 5)'), 'seven-menu second row selector is missing');
assert(css.includes('grid-column: span 4'), 'seven-menu second row must split into three equal cells');

assert(css.includes('min-height: 44px'), 'balanced menu buttons must preserve the 44px touch target');
assert(css.includes('white-space: normal') && css.includes('overflow-wrap: anywhere'), 'balanced menu labels must continue wrapping without ellipsis');
assert(!css.includes('overflow-x: auto'), 'balanced top navigation must not reintroduce horizontal scrolling');

console.log(JSON.stringify({
  ok: true,
  rows: {
    5: [3, 2],
    6: [3, 3],
    7: [4, 3],
    8: [4, 4],
  },
}, null, 2));

import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [layout, css, runtimeCss] = await Promise.all([
  readFile('src/preview/renderers/LayoutBlocks.jsx', 'utf8'),
  readFile('src/styles/preview-workspace-topnav-balance.css', 'utf8'),
  readFile('src/styles/preview-topnav-runtime-contract.css', 'utf8'),
]);

assert(layout.includes('storedMenus.slice(0, 8)'), 'top navigation must continue rendering up to eight menus');
assert(layout.includes('topnav-menu-count-${menuCount}'), 'top navigation must expose its menu count as a CSS class');
assert(layout.includes("menuCount > 4 ? 'topnav-menu-two-row' : ''"), 'five or more menus must remain in wrapped mode');

assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set {\n  grid-template-columns: repeat(3, minmax(0, 1fr))'), 'workspace five-menu layout must use a true three-column grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {\n  grid-column: auto !important;'), 'workspace five-menu buttons must use normal row-major placement');
assert(!css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4)'), 'workspace five-menu second row must not be stretched or recentered');

assert(runtimeCss.includes('.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set {\n  grid-template-columns: repeat(3, minmax(0, 1fr))'), 'public runtime five-menu layout must use a true three-column grid');
assert(runtimeCss.includes('.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {\n  grid-column: auto !important;'), 'public runtime five-menu buttons must use normal row-major placement');
assert(!runtimeCss.includes('topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4)'), 'final runtime CSS must not stretch the five-menu second row');

assert(css.includes('.topnav-one-line.topnav-menu-count-6 .top-menu-set'), 'six-menu grid override is missing');
assert(css.includes('grid-template-columns: repeat(6, minmax(0, 1fr))'), 'six menus must keep the six-unit grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-7 .top-menu-set'), 'seven-menu grid override is missing');
assert(css.includes('.topnav-one-line.topnav-menu-count-8 .top-menu-set'), 'eight-menu grid override is missing');
assert(css.includes('grid-template-columns: repeat(12, minmax(0, 1fr))'), 'seven and eight menus must use a twelve-unit balancing grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-7 .top-menu-set > button:nth-child(n + 5)'), 'seven-menu second row selector is missing');
assert(css.includes('grid-column: span 4'), 'seven-menu second row must split into three equal cells');
assert(css.includes('min-height: 44px'), 'menu buttons must preserve the 44px touch target');
assert(css.includes('white-space: normal') && css.includes('overflow-wrap: anywhere'), 'menu labels must continue wrapping without ellipsis');
assert(!css.includes('overflow-x: auto'), 'top navigation must not reintroduce horizontal scrolling');

console.log(JSON.stringify({
  ok: true,
  rows: {
    5: [3, 2],
    6: [3, 3],
    7: [4, 3],
    8: [4, 4],
  },
  fiveMenuAlignment: 'left',
  finalRuntimeOwnerChecked: true,
}, null, 2));

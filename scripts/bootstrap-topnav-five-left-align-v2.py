from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


runtime_old = """/* 5 menus: 3 + 2, with every row consuming the full menu width. */
.phone-frame .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set,
.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
}

.phone-frame .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button,
.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {
  grid-column: span 2 !important;
}

.phone-frame .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4),
.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4) {
  grid-column: span 3 !important;
}
"""
runtime_new = """/* 5 menus: a true 3-column grid. The incomplete second row starts at column one. */
.phone-frame .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set,
.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  justify-content: start !important;
}

.phone-frame .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button,
.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {
  grid-column: auto !important;
}
"""
replace_once('src/styles/preview-topnav-runtime-contract.css', runtime_old, runtime_new)

workspace_old = """/* Keep wrapped rows consistent while leaving incomplete rows aligned left. */
.topnav-one-line.topnav-menu-count-5 .top-menu-set,
.topnav-one-line.topnav-menu-count-6 .top-menu-set {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
}

.topnav-one-line.topnav-menu-count-7 .top-menu-set,
.topnav-one-line.topnav-menu-count-8 .top-menu-set {
  grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
}

.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {
  grid-column: span 2 !important;
}
"""
workspace_new = """/* Keep wrapped rows consistent while leaving incomplete rows aligned left. */
.topnav-one-line.topnav-menu-count-5 .top-menu-set {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  justify-content: start !important;
}

.topnav-one-line.topnav-menu-count-6 .top-menu-set {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
}

.topnav-one-line.topnav-menu-count-7 .top-menu-set,
.topnav-one-line.topnav-menu-count-8 .top-menu-set {
  grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
}

.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {
  grid-column: auto !important;
}
"""
replace_once('src/styles/preview-workspace-topnav-balance.css', workspace_old, workspace_new)

quality = """import { readFile } from 'node:fs/promises';

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

assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set {\\n  grid-template-columns: repeat(3, minmax(0, 1fr))'), 'workspace five-menu layout must use a true three-column grid');
assert(css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {\\n  grid-column: auto !important;'), 'workspace five-menu buttons must use normal row-major placement');
assert(!css.includes('.topnav-one-line.topnav-menu-count-5 .top-menu-set > button:nth-child(n + 4)'), 'workspace five-menu second row must not be stretched or recentered');

assert(runtimeCss.includes('.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set {\\n  grid-template-columns: repeat(3, minmax(0, 1fr))'), 'public runtime five-menu layout must use a true three-column grid');
assert(runtimeCss.includes('.public-landing-viewport .topnav.topnav-one-line.topnav-menu-count-5 .top-menu-set > button {\\n  grid-column: auto !important;'), 'public runtime five-menu buttons must use normal row-major placement');
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
"""
Path('scripts/topnav-row-balance-quality-check.mjs').write_text(quality, encoding='utf-8')

replace_once(
    'scripts/landing-browser-regression-check.mjs',
    "function createQaPage() {\n  const menus = Array.from({ length: 7 }, (_, index) => ({",
    "function createQaPage(menuCount = 7) {\n  const menus = Array.from({ length: menuCount }, (_, index) => ({",
)
replace_once(
    'scripts/landing-browser-regression-check.mjs',
    "function initScript() {\n  return `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(${JSON.stringify(createQaPage())}));`;\n}",
    "function storageScript(menuCount = 7) {\n  return `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, JSON.stringify(${JSON.stringify(createQaPage(menuCount))}));`;\n}\n\nfunction initScript() {\n  return `if (!localStorage.getItem(${JSON.stringify(STORAGE_KEY)})) { ${storageScript(7)} }`;\n}",
)

baseline_marker = """function assertVisible(state, label) {
  assert(state?.display !== 'none' && state?.visibility !== 'hidden' && state?.opacity > 0.5, `${label} is not visible: ${JSON.stringify(state)}`);
}
"""
five_assert = baseline_marker + """
function assertFiveMenuLeftAligned(data, viewport) {
  assert(data.menuButtons?.length === 5, `${viewport.name} expected 5 menu buttons, got ${data.menuButtons?.length || 0}`);
  assert(JSON.stringify(data.menuRows) === JSON.stringify([3, 2]), `${viewport.name} five-menu rows must be 3+2, got ${JSON.stringify(data.menuRows)}`);
  const [menu1, menu2, menu3, menu4, menu5] = data.menuButtons;
  const tolerance = 2;
  assert(Math.abs(menu1.left - menu4.left) <= tolerance, `${viewport.name} menu 4 must align with menu 1: ${JSON.stringify({ menu1, menu4 })}`);
  assert(Math.abs(menu2.left - menu5.left) <= tolerance, `${viewport.name} menu 5 must align with menu 2: ${JSON.stringify({ menu2, menu5 })}`);
  assert(Math.abs(menu1.width - menu4.width) <= tolerance, `${viewport.name} menu 4 width must match menu 1`);
  assert(Math.abs(menu2.width - menu5.width) <= tolerance, `${viewport.name} menu 5 width must match menu 2`);
  assert(menu5.right <= menu3.left + tolerance, `${viewport.name} five-menu final row must leave the third column empty: ${JSON.stringify({ menu3, menu5 })}`);
}
"""
replace_once('scripts/landing-browser-regression-check.mjs', baseline_marker, five_assert)

focus_old = """        const focusFile = path.join(screenshotDir, `${viewport.name}-form-focus.png`);
        await capture(client, focusFile);
        results.push({ scenario: 'form-focus', viewport: viewport.name, file: focusFile, data: focused });
      }
"""
focus_new = """        const focusFile = path.join(screenshotDir, `${viewport.name}-form-focus.png`);
        await capture(client, focusFile);
        results.push({ scenario: 'form-focus', viewport: viewport.name, file: focusFile, data: focused });

        await evaluate(client, storageScript(5));
        await client.send('Page.reload', { ignoreCache: true });
        await waitForLanding(client);
        await wait(500);
        const fiveMenu = await collectMetrics(client);
        assertFiveMenuLeftAligned(fiveMenu, viewport);
        const fiveMenuFile = path.join(screenshotDir, `${viewport.name}-five-menu-left.png`);
        await capture(client, fiveMenuFile);
        results.push({ scenario: 'five-menu-left', viewport: viewport.name, file: fiveMenuFile, data: fiveMenu });
      }
"""
replace_once('scripts/landing-browser-regression-check.mjs', focus_old, focus_new)
replace_once(
    'scripts/landing-browser-regression-check.mjs',
    "assert(results.length === viewports.length + 1, `Expected ${viewports.length + 1} visual results, got ${results.length}`);",
    "assert(results.length === viewports.length + 2, `Expected ${viewports.length + 2} visual results, got ${results.length}`);",
)

contract_path = Path('scripts/landing-browser-regression-contract-check.mjs')
contract = contract_path.read_text(encoding='utf-8')
needle = "assert(visual.includes('JSON.stringify([4, 3])'), 'seven-menu browser QA must enforce a 4+3 row split');\n"
addition = needle + "assert(visual.includes('function createQaPage(menuCount = 7)') && visual.includes('storageScript(5)'), 'browser QA must render a dedicated five-menu scenario');\nassert(visual.includes('assertFiveMenuLeftAligned') && visual.includes('menu 4 must align with menu 1') && visual.includes('menu 5 must align with menu 2'), 'five-menu browser QA must compare real x coordinates');\nassert(visual.includes('JSON.stringify([3, 2])'), 'five-menu browser QA must enforce a 3+2 row split');\n"
if contract.count(needle) != 1:
    raise SystemExit('landing contract insertion point missing')
contract = contract.replace(needle, addition, 1)
contract = contract.replace(
    "assert(visual.includes('Page.captureScreenshot') && visual.includes('-baseline.png') && visual.includes('-form-focus.png'), 'browser QA must emit baseline and focused screenshots');",
    "assert(visual.includes('Page.captureScreenshot') && visual.includes('-baseline.png') && visual.includes('-form-focus.png') && visual.includes('-five-menu-left.png'), 'browser QA must emit baseline, focused, and five-menu alignment screenshots');",
    1,
)
contract = contract.replace(
    "scenarios: ['baseline', 'form-focus'],",
    "scenarios: ['baseline', 'form-focus', 'five-menu-left'],",
    1,
)
contract_path.write_text(contract, encoding='utf-8')

print('Applied exact five-menu left-alignment patch to final runtime owner and browser regression.')

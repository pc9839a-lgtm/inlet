import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const renderer = read('src/preview/LandingRenderer.jsx');
const tabs = read('src/editor/ui/EditorTabs.jsx');
const field = read('src/editor/FieldControl.jsx');
const menus = read('src/editor/editPanelParts/ScreenOrderRowActions.jsx');
const style = read('src/panels/StylePanel.jsx');

assert.match(renderer, /normalRaw\.filter\(\(b\)=>b\.id !== topNavBlock\?\.id\)/, 'rendering must follow ordinary block order');
assert.doesNotMatch(renderer, /heroBlock \? \[heroBlock\]/, 'hero must not be forcibly pinned');
for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
  assert(tabs.includes(key), 'missing keyboard tab binding ' + key);
}
assert.equal((field.match(/value=\{value \?\? ''\}/g) || []).length, 2, '0 must render in text and number input');
assert.match(menus, /document\.addEventListener\('pointerdown', closeOutside, true\)/);
assert.match(menus, /pagero:screen-order-menu-open/);
assert.match(style, /aria-label=\{label\}/);
assert.match(style, /aria-pressed=\{String\(value\) === String\(key\)\}/);
process.stdout.write('PASS editor interaction regression contracts\n');

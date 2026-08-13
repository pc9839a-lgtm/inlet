import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cssFiles = [
  'src/styles/base.css',
  'src/styles/base-components.css',
  'src/styles/base-components-options.css',
  'src/styles/base-components-html.css',
  'src/styles/base-components-rich.css',
  'src/styles/base-components-image.css',
  'src/styles/base-components-integrations.css',
  'src/styles/base-components-connections.css',
  'src/styles/base-components-revisions.css',
  'src/styles/base-public.css',
  'src/styles/base-public-screen-order.css',
  'src/styles/base-public-screen-toggle.css',
  'src/styles/base-public-add-dock.css',
  'src/styles/base-public-home-v2.css',
  'src/styles/base-public-live.css',
  'src/styles/base-public-live-inbox.css',
  'src/styles/base-public-live-ghost.css',
  'src/styles/base-public-live-actions.css',
  'src/styles/base-public-live-thumb.css',
  'src/styles/base-public-live-loop.css',
  'src/styles/base-public-utility.css',
  'src/styles/base-start-mode.css',
  'src/styles/editor.css',
  'src/styles/editor-rich.css',
  'src/styles/editor-blocks.css',
  'src/styles/editor-animation.css',
  'src/styles/editor-wysiwyg.css',
  'src/styles/editor-dock.css',
  'src/styles/editor-widget-controls.css',
  'src/styles/editor-download.css',
  'src/styles/editor-stack.css',
  'src/styles/editor-demo.css',
  'src/styles/panels.css',
  'src/styles/panels-metrics.css',
  'src/styles/panels-settings.css',
  'src/styles/panels-inbox-v2.css',
  'src/styles/panels-connect.css',
  'src/styles/panels-connect-line.css',
  'src/styles/panels-connect-v3.css',
  'src/styles/panels-inbox-v3.css',
  'src/styles/panels-inbox.css',
  'src/styles/panels-home-shell.css',
  'src/styles/panels-home-create.css',
  'src/styles/panels-create-modal.css',
  'src/styles/panels-create-flow.css',
  'src/styles/panels-template-choice.css',
  'src/styles/panels-home.css',
  'src/styles/panels-home-auth.css',
  'src/styles/panels-home-ai.css',
  'src/styles/panels-home-template-preview.css',
  'src/styles/panels-home-template-rail.css',
  'src/styles/preview-core.css',
  'src/styles/preview-forms.css',
  'src/styles/preview-forms-visibility.css',
  'src/styles/preview-forms-design.css',
  'src/styles/preview-forms-basic.css',
  'src/styles/preview-forms-render.css',
  'src/styles/preview-forms-controls.css',
  'src/styles/preview-forms-spacing.css',
  'src/styles/preview-forms-questions.css',
  'src/styles/preview-forms-advanced.css',
  'src/styles/preview-forms-bottom-color.css',
  'src/styles/preview-forms-description.css',
  'src/styles/preview-forms-buttons.css',
  'src/styles/preview-forms-button-effects.css',
  'src/styles/preview-forms-basic-grid.css',
  'src/styles/preview-reservation.css',
  'src/styles/preview-bottom.css',
  'src/styles/preview-widgets.css',
  'src/styles/preview-widgets-timer.css',
  'src/styles/preview-widgets-activity.css',
  'src/styles/preview-widgets-activity-timer-theme.css',
  'src/styles/preview-widgets-activity-feed.css',
  'src/styles/preview-widgets-activity-text.css',
  'src/styles/preview-widgets-activity-dark.css',
  'src/styles/preview-widgets-forms.css',
  'src/styles/preview-widgets-links.css',
  'src/styles/preview-widgets-links-items.css',
  'src/styles/preview-widgets-links-list.css',
  'src/styles/preview-widgets-links-carousel.css',
  'src/styles/preview-widgets-links-card.css',
  'src/styles/preview-download.css',
  'src/styles/preview-workspace.css',
  'src/styles/preview-workspace-bottom-timer.css',
  'src/styles/preview-workspace-hero-media.css',
  'src/styles/preview-workspace-bottom-card.css',
  'src/styles/preview-workspace-topnav-override.css',
  'src/styles/preview-workspace-empty.css',
  'src/styles/preview-workspace-template.css',
  'src/styles/preview-workspace-timer-minimal.css',
  'src/styles/preview-workspace-timer-urgency.css',
  'src/styles/preview-workspace-timer-bottom.css',
  'src/styles/preview-workspace-reservation.css',
  'src/styles/preview-workspace-hero-full.css',
  'src/styles/preview-workspace-hero-content.css',
  'src/styles/preview-workspace-topnav-menu.css',
  'src/styles/preview-workspace-topnav-drag.css',
  'src/styles/preview-workspace-topnav-card.css',
  'src/styles/preview-workspace-effects.css',
  'src/styles/preview-workspace-effects-buttons.css',
  'src/styles/preview-workspace-effects-buttons-clarity.css',
  'src/styles/preview-workspace-effects-bottom-editor.css',
  'src/styles/preview-workspace-effects-fonts.css',
  'src/styles/preview-workspace-effects-nav.css',
  'src/styles/preview-workspace-effects-widgets.css',
  'src/styles/preview-workspace-effects-map-faq.css',
  'src/styles/preview-widget-style-options.css',
  'src/styles/base-wayzi-footer.css',
];
const lazyCssOwners = {
  'src/styles/editor.css': 'src/app-styles.css',
  'src/styles/editor-rich.css': 'src/app-styles.css',
  'src/styles/editor-blocks.css': 'src/app-styles.css',
  'src/styles/editor-animation.css': 'src/app-styles.css',
  'src/styles/editor-wysiwyg.css': 'src/app-styles.css',
  'src/styles/editor-dock.css': 'src/app-styles.css',
  'src/styles/editor-widget-controls.css': 'src/app-styles.css',
  'src/styles/editor-download.css': 'src/app-styles.css',
  'src/styles/editor-stack.css': 'src/app-styles.css',
  'src/styles/editor-demo.css': 'src/app-styles.css',
  'src/styles/panels.css': 'src/app-styles.css',
  'src/styles/panels-metrics.css': 'src/app-styles.css',
  'src/styles/panels-settings.css': 'src/app-styles.css',
  'src/styles/panels-create-modal.css': 'src/app-styles.css',
  'src/styles/panels-inbox-v2.css': 'src/panels/InboxPanel.css',
  'src/styles/panels-inbox-v3.css': 'src/panels/InboxPanel.css',
  'src/styles/panels-inbox.css': 'src/panels/InboxPanel.css',
  'src/styles/panels-connect.css': 'src/panels/InboxPanel.css',
  'src/styles/panels-connect-line.css': 'src/panels/InboxPanel.css',
  'src/styles/panels-connect-v3.css': 'src/panels/InboxPanel.css',
  'src/styles/panels-template-choice.css': 'src/panels/TemplatesPanel.css',
  'src/styles/panels-home-template-preview.css': 'src/panels/TemplatesPanel.css',
  'src/styles/panels-home-template-rail.css': 'src/panels/TemplatesPanel.css',
  'src/styles/panels-home-shell.css': 'src/screens/HomeScreens.css',
  'src/styles/panels-home-create.css': 'src/screens/HomeScreens.css',
  'src/styles/panels-create-flow.css': 'src/screens/HomeScreens.css',
  'src/styles/panels-home.css': 'src/screens/HomeScreens.css',
  'src/styles/panels-home-auth.css': 'src/screens/HomeScreens.css',
  'src/styles/panels-home-ai.css': 'src/screens/HomeScreens.css',
};
for (const file of cssFiles) {
  if (file.startsWith('src/styles/preview-')) lazyCssOwners[file] = 'src/preview/LandingRenderer.css';
}
const entryPath = path.resolve('src/styles.css');
const maxTotalBytes = Number(process.env.INLET_CSS_BUDGET_BYTES || 550000);
const baselineBytes = Number(process.env.INLET_CSS_BASELINE_BYTES || 543143);
const allowBaselineIncrease = process.env.INLET_CSS_ALLOW_BASELINE_INCREASE === '1';
const maxFileBytes = Number(process.env.INLET_CSS_FILE_BUDGET_BYTES || 260000);
const warnRatio = Number(process.env.INLET_CSS_WARN_RATIO || 0.9);
const shouldFix = process.argv.includes('--fix');
const compactOutput = process.env.INLET_QA_COMPACT === '1' || process.env.CF_PAGES === '1';
const duplicateRuleExemptFiles = new Set(['src/styles/base-public-home-v2.css']);
const areaBudgets = {
  base: Number(process.env.INLET_CSS_BASE_BUDGET_BYTES || 125000),
  publicHome: Number(process.env.INLET_CSS_PUBLIC_HOME_BUDGET_BYTES || 200000),
  editor: Number(process.env.INLET_CSS_EDITOR_BUDGET_BYTES || 50000),
  panels: Number(process.env.INLET_CSS_PANELS_BUDGET_BYTES || 95000),
  preview: Number(process.env.INLET_CSS_PREVIEW_BUDGET_BYTES || 260000),
};
const catchAllFileBaselines = {
  'src/styles/preview-core.css': 11612,
  'src/styles/preview-widgets.css': 7325,
  'src/styles/preview-workspace.css': 5246,
  'src/styles/preview-bottom.css': 9976,
  'src/styles/panels.css': 2227,
  'src/styles/editor.css': 5617,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findDuplicateRules(css) {
  const rulePattern = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  const seen = new Set();
  const duplicates = [];
  let match;
  while ((match = rulePattern.exec(css))) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    const body = match[2].trim().replace(/\s+/g, ' ');
    if (!selector || selector.includes('@')) continue;
    if (selector === 'from' || selector === 'to' || /^[\d.,%\s]+$/.test(selector)) continue;
    if (/^(media|supports|container|keyframes)\b/.test(selector)) continue;
    const key = `${selector}{${body}}`;
    if (seen.has(key)) duplicates.push({ key, start: match.index, end: rulePattern.lastIndex });
    seen.add(key);
  }
  return duplicates;
}

function removeDuplicateRules(css) {
  const rulePattern = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  const seen = new Set();
  return css.replace(rulePattern, (full, selectorRaw, bodyRaw) => {
    const selector = selectorRaw.trim().replace(/\s+/g, ' ');
    const body = bodyRaw.trim().replace(/\s+/g, ' ');
    if (!selector || selector.includes('@')) return full;
    if (selector === 'from' || selector === 'to' || /^[\d.,%\s]+$/.test(selector)) return full;
    if (/^(media|supports|container|keyframes)\b/.test(selector)) return full;
    const key = `${selector}{${body}}`;
    if (seen.has(key)) return '';
    seen.add(key);
    return full;
  });
}

function removeComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function cssArea(file) {
  const name = path.basename(file);
  if (name === 'base-public-home-v2.css') return 'publicHome';
  if (name.startsWith('preview-')) return 'preview';
  if (name.startsWith('editor')) return 'editor';
  if (name.startsWith('panels')) return 'panels';
  return 'base';
}

const entry = await readFile(entryPath, 'utf8');
assert(!entry.includes('legacy.css'), 'src/styles.css must import split CSS modules, not legacy.css');
assert(!entry.includes('styles/preview.css'), 'src/styles.css must import preview CSS modules directly, not preview.css');
const ownerCache = new Map();

async function ownerContent(file) {
  if (!ownerCache.has(file)) ownerCache.set(file, await readFile(path.resolve(file), 'utf8'));
  return ownerCache.get(file);
}

const mojibakePattern = /�|諛|獄|揆|珥|吏|遺|誘몃|蹂닿|媛|덈|윭|ㅺ|ㅽ|뙣|섏씠|/;

for (const file of cssFiles) {
  const cssSource = await readFile(path.resolve(file), 'utf8');
  if (!cssSource.trim()) continue;
  const importPath = file.replace('src/', './');
  const lazyOwner = lazyCssOwners[file];
  if (!lazyOwner) {
    assert(entry.includes(importPath), `src/styles.css missing import ${importPath}`);
    continue;
  }

  const relativeImportPath = path.relative(path.dirname(lazyOwner), file).replaceAll('\\', '/');
  const lazyImportPath = relativeImportPath.startsWith('.') ? relativeImportPath : `./${relativeImportPath}`;
  assert(
    entry.includes(importPath) || (await ownerContent(lazyOwner)).includes(lazyImportPath),
    `${file} must be imported from src/styles.css or ${lazyOwner}`
  );
}

const reports = [];
const areas = {};
const areaReports = {};
let beforeBytes = 0;
let totalBytes = 0;
let combined = '';

for (const file of cssFiles) {
  const cssPath = path.resolve(file);
  const before = await readFile(cssPath, 'utf8');
  assert(!mojibakePattern.test(before), `${file} contains mojibake or replacement characters`);
  let after = before;
  if (shouldFix) {
    after = removeDuplicateRules(removeComments(before));
    if (after !== before) await writeFile(cssPath, after, 'utf8');
  }

  const bytes = Buffer.byteLength(after, 'utf8');
  beforeBytes += Buffer.byteLength(before, 'utf8');
  totalBytes += bytes;
  if (!duplicateRuleExemptFiles.has(file)) combined += `\n${after}`;
  const area = cssArea(file);
  areas[area] = (areas[area] || 0) + bytes;
  reports.push({ file, bytes, removedBytes: Buffer.byteLength(before, 'utf8') - bytes });
  assert(bytes <= maxFileBytes, `${file} budget exceeded: ${bytes} > ${maxFileBytes}`);
  const catchAllBaseline = catchAllFileBaselines[file];
  assert(
    allowBaselineIncrease || !catchAllBaseline || bytes <= catchAllBaseline,
    `${file} grew above focused ownership baseline: ${bytes} > ${catchAllBaseline}`
  );
}

const duplicates = findDuplicateRules(combined);

assert(totalBytes <= maxTotalBytes, `split CSS budget exceeded: ${totalBytes} > ${maxTotalBytes}`);
assert(allowBaselineIncrease || totalBytes <= baselineBytes, `split CSS grew above baseline: ${totalBytes} > ${baselineBytes}`);
assert(duplicates.length === 0, `split CSS has ${duplicates.length} exact duplicate rule(s)`);

for (const [area, bytes] of Object.entries(areas)) {
  const budget = areaBudgets[area];
  assert(!budget || bytes <= budget, `${area} CSS budget exceeded: ${bytes} > ${budget}`);
  areaReports[area] = {
    bytes,
    budget,
    usage: budget ? Number((bytes / budget).toFixed(3)) : null,
    warning: !!budget && bytes >= budget * warnRatio,
  };
}

const warnings = [
  ...(totalBytes >= maxTotalBytes * warnRatio ? [`total CSS budget usage ${totalBytes}/${maxTotalBytes}`] : []),
  ...Object.entries(areaReports)
    .filter(([, report]) => report.warning)
    .map(([area, report]) => `${area} CSS budget usage ${report.bytes}/${report.budget}`),
  ...reports
    .filter((report) => report.bytes >= maxFileBytes * warnRatio)
    .map((report) => `${report.file} CSS file budget usage ${report.bytes}/${maxFileBytes}`),
];

console.log(JSON.stringify({
  ok: true,
  bytes: totalBytes,
  budget: maxTotalBytes,
  baseline: baselineBytes,
  baselineEnforced: !allowBaselineIncrease,
  usage: Number((totalBytes / maxTotalBytes).toFixed(3)),
  removedBytes: beforeBytes - totalBytes,
  duplicateRules: duplicates.length,
  warnings,
  areas: Object.fromEntries(Object.entries(areaReports).sort(([a], [b]) => a.localeCompare(b))),
  areaBudgets,
  catchAllFileBaselines,
  fileCount: reports.length,
  largestFiles: reports.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 8),
  ...(compactOutput ? {} : { files: reports }),
}, null, 2));

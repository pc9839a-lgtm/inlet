import { normalizeBottomTarget } from './bottomBarEditorModel.js';

export function resolveBottomLinkTarget(button, blocks = []) {
  const normalized = normalizeBottomTarget(button.target, blocks);
  const savedWidget = normalizeBottomTarget(button.lastWidgetTarget, blocks);
  const first = blocks[0]?.id ? `block:${blocks[0].id}` : 'hero';
  const currentWidget = normalized.startsWith('block:')
    ? normalized
    : (savedWidget.startsWith('block:') ? savedWidget : first);
  const mode = normalized === 'url' ? 'url' : 'widget';

  return { normalized, currentWidget, mode };
}

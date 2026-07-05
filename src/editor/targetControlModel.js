export const TARGET_LABELS = {
  move: '이동',
  widget: '위젯',
  link: '링크',
  moveWidget: '이동할 위젯',
  linkUrl: '링크 URL',
};

export function getTargetBlocks(page) {
  return (page?.blocks || []).filter((block) => block.type !== 'bottombar');
}

export function normalizeTarget(target, blocks = []) {
  const raw = String(target || '');
  if (!raw) return blocks[0]?.id ? `block:${blocks[0].id}` : 'hero';
  if (raw.startsWith('block:')) {
    const id = raw.replace('block:', '');
    return blocks.some((block) => block.id === id) ? raw : (blocks[0]?.id ? `block:${blocks[0].id}` : 'hero');
  }
  if (raw === 'url') return raw;
  const byType = blocks.find((block) => block.type === raw);
  return byType ? `block:${byType.id}` : (blocks[0]?.id ? `block:${blocks[0].id}` : 'hero');
}

export function getTargetControlState({ page, target, lastWidgetTarget }) {
  const blocks = getTargetBlocks(page);
  const normalized = normalizeTarget(target, blocks);
  const savedWidget = normalizeTarget(lastWidgetTarget, blocks);
  const first = blocks[0]?.id ? `block:${blocks[0].id}` : 'hero';
  const currentWidget = normalized.startsWith('block:') ? normalized : (savedWidget.startsWith('block:') ? savedWidget : first);
  const mode = normalized === 'url' ? 'url' : 'widget';
  return { blocks, currentWidget, mode };
}

export function getSafeUrl(url) {
  return url && !String(url).startsWith('tel:') ? url : 'https://';
}
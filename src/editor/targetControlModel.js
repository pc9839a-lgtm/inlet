export const TARGET_LABELS = {
  move: '이동',
  widget: '위젯',
  link: '링크',
  phone: '전화',
  moveWidget: '이동할 위젯',
  linkUrl: '링크 URL',
  phoneNumber: '전화번호',
};

export function getTargetBlocks(page) {
  return (page?.blocks || []).filter((block) => block.type !== 'bottombar');
}

// Keep broken references intact: replacing them with the first block hides broken published links.
export function normalizeTarget(target, blocks = []) {
  const raw = String(target || '');
  if (!raw || raw === 'url' || raw === 'phone' || raw.startsWith('block:')) return raw;
  const byType = blocks.find((block) => block.id === raw || block.s?.anchorId === raw || block.type === raw);
  return byType ? `block:${byType.id}` : raw;
}

export function isValidWidgetTarget(target, blocks = []) {
  return String(target || '').startsWith('block:') &&
    blocks.some((block) => `block:${block.id}` === target);
}

export function getTargetControlState({ page, target, lastWidgetTarget }) {
  const blocks = getTargetBlocks(page);
  const normalized = normalizeTarget(target, blocks);
  const savedWidget = normalizeTarget(lastWidgetTarget, blocks);
  const first = blocks[0]?.id ? `block:${blocks[0].id}` : '';
  const mode = normalized === 'url' ? 'url' : normalized === 'phone' ? 'phone' : 'widget';
  const currentWidget = mode === 'widget' ? normalized : (savedWidget || first);
  return {
    blocks,
    normalized,
    currentWidget,
    mode,
    invalidWidgetTarget: mode === 'widget' && !isValidWidgetTarget(currentWidget, blocks),
  };
}

export function getSafeUrl(url, savedUrl = '') {
  const isWebUrl = (value) => !!value && !String(value).startsWith('tel:');
  return isWebUrl(url) ? url : (isWebUrl(savedUrl) ? savedUrl : 'https://');
}

export function getSafePhoneUrl(url, savedPhoneUrl = '') {
  const raw = String(url || '').trim();
  if (raw.startsWith('tel:')) return raw;
  if (raw && !/^[a-z]+:/i.test(raw)) return `tel:${raw}`;
  const saved = String(savedPhoneUrl || '');
  return saved.startsWith('tel:') ? saved : 'tel:';
}

export function changeTargetMode({ nextMode, mode, url, lastUrl, lastPhoneUrl, currentWidget }) {
  const savedUrl = mode === 'url' ? getSafeUrl(url, lastUrl) : (lastUrl || '');
  const savedPhoneUrl = mode === 'phone' ? getSafePhoneUrl(url, lastPhoneUrl) : (lastPhoneUrl || '');
  const remembered = {
    lastWidgetTarget: currentWidget,
    lastUrl: savedUrl,
    lastPhoneUrl: savedPhoneUrl,
  };
  if (nextMode === 'url') return { ...remembered, target: 'url', url: getSafeUrl(savedUrl) };
  if (nextMode === 'phone') return { ...remembered, target: 'phone', url: getSafePhoneUrl(savedPhoneUrl) };
  return { ...remembered, target: currentWidget, url: '' };
}

// Editor-only presentation state. The public renderer already respects explicit
// text colors, page-wide alignment priority, and custom bottom-button colors.
const HEX = /^#[0-9a-f]{6}$/i;
const ALIGN = new Set(['left', 'center', 'right']);
export const themeAlignmentMode = (theme = {}) => ALIGN.has(theme?.globalAlign) ? theme.globalAlign : 'block';
export const isTextColorOverride = (settings = {}) => HEX.test(String(settings?.textColor || ''));
export const isBottomButtonColorOverride = (settings = {}) => settings?.buttonColorMode === 'custom';

export function describeTextColorSource(settings = {}, theme = {}) {
  return {
    inherited: !isTextColorOverride(settings),
    color: isTextColorOverride(settings) ? settings.textColor : theme?.text || '#111827',
  };
}
export function describeBottomButtonColorSource(settings = {}, theme = {}) {
  if (isBottomButtonColorOverride(settings)) {
    return { source: 'block', inherited: false, color: settings.buttonColor || '#111827', label: '개별 지정' };
  }
  if (settings?.color === 'accent') {
    return { source: 'page', inherited: true, color: theme?.accent || '#111827', label: '전체 포인트색 사용' };
  }
  if (settings?.color === 'light') {
    return { source: 'preset', inherited: false, color: '#FFFFFF', label: '라이트 프리셋' };
  }
  return { source: 'preset', inherited: false, color: '#111827', label: '다크 프리셋' };
}
export function countTextColorSources(blocks = []) {
  const text = Array.isArray(blocks) ? blocks.filter(block => block?.type === 'text') : [];
  return {
    total: text.length,
    inherited: text.filter(block => !isTextColorOverride(block.s)).length,
    custom: text.filter(block => isTextColorOverride(block.s)).length,
  };
}

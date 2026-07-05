export function getLinkIcon(item) {
  if (item.iconMode === 'thumb') return '이미지';
  if (item.iconMode === 'none') return '링크';
  return item.emoji || '🔗';
}

export function getLinkBadge(item) {
  return item.target === 'url' ? '링크' : '위젯';
}
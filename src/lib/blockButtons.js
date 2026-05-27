const uid = () => Math.random().toString(36).slice(2, 10);

export function normalizeButtons(buttons = [], count = 1) {
  const defaults = [
    { id: uid(), enabled: true, icon: '💬', label: '상담', target: 'form', url: '' },
    { id: uid(), enabled: true, icon: '📅', label: '예약', target: 'reservation', url: '' },
    { id: uid(), enabled: true, icon: '📞', label: '전화', target: 'phone', url: 'tel:01000000000' },
  ];

  return Array.from({ length: Number(count) }, (_, i) => {
    const source = buttons[i] || {};
    const fallback = defaults[i] || { id: uid(), enabled: true, icon: '🔗', label: '버튼', target: 'form', url: '' };

    return {
      ...fallback,
      ...source,
      id: source.id || fallback.id || uid(),
      enabled: source.enabled !== false,
      icon: Object.prototype.hasOwnProperty.call(source, 'icon') ? source.icon : (fallback.icon || '🔗'),
      label: source.label || fallback.label || '버튼',
      lastWidgetTarget: source.lastWidgetTarget || fallback.lastWidgetTarget || '',
    };
  });
}

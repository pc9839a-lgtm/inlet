export function pickSafe(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

export function hexToRgb(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rich(text) {
  const raw = String(text || '');

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
    const root = doc.body.firstElementChild;

    const hasUnderline = (node) => {
      const decoration = `${node.style?.textDecoration || ''} ${node.style?.textDecorationLine || ''}`.toLowerCase();
      return decoration.includes('underline');
    };

    const hasBoldWeight = (node) => {
      const weight = String(node.style?.fontWeight || '').toLowerCase();
      if (!weight || weight === 'normal' || weight === '400') return false;
      if (weight === 'bold' || weight === 'bolder') return true;
      const numeric = Number(weight);
      return Number.isFinite(numeric) && numeric >= 600;
    };

    const normalizeColor = (color) => {
      const raw = String(color || '').trim();
      const rgb = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!rgb) return raw;
      return `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
    };

    const styleAttr = (node) => {
      const color = normalizeColor(node.style?.color || node.getAttribute?.('color') || '');
      return color ? ` style="color:${color}"` : '';
    };

    const clean = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      let inner = Array.from(node.childNodes).map(clean).join('');

      if (tag === 'br') return '<br>';
      if (tag === 'strong' || tag === 'b' || hasBoldWeight(node)) inner = `<strong>${inner}</strong>`;
      if (tag === 'u' || hasUnderline(node)) inner = `<u>${inner}</u>`;

      if (tag === 'span' || tag === 'font') {
        const style = styleAttr(node);
        return style ? `<span${style}>${inner}</span>` : inner;
      }

      if (tag === 'div' || tag === 'p') return inner ? `${inner}<br>` : '';
      return inner;
    };

    const html = Array.from(root.childNodes).map(clean).join('').replace(/(<br>\s*)+$/g, '');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
}

export function widgetBoxVars(s = {}) {
  const margin = Math.max(0, Math.min(48, Number(s.marginY ?? 24)));
  const padding = Math.max(0, Math.min(44, Number(s.paddingY ?? 22)));
  const radiusMap = { square: '8px', round: 'var(--radius)', pill: '999px' };
  return {
    '--widget-bg': s.bgColor || '#FFFFFF',
    '--widget-padding': `${padding}px`,
    '--widget-margin': `${margin}px`,
    '--widget-radius': radiusMap[s.radiusStyle] || 'var(--radius)',
  };
}

export function widgetBoxClass(s = {}) {
  return [
    s.bgEnabled ? 'widget-bg-on' : '',
    s.shadowEnabled ? 'widget-shadow-on' : '',
  ].filter(Boolean).join(' ');
}

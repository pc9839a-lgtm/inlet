// Source spans let ordinary content edits preserve every unrelated byte of custom code.
// Deliberately omit script/style/template content, dynamic values and rich HTML.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const BLOCKED = new Set('script style template noscript svg math head textarea pre code'.split(' '));
const TEXT = new Set('h1 h2 h3 h4 h5 h6 p span div strong em label a button'.split(' '));
const TOKENS = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[A-Za-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g;
const dynamic = (value) => /\{\{|\$\{|<%/.test(value);
const decode = (value) => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
  if (entity[0] === '#') {
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[entity.toLowerCase()] || match;
});
const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function readCodeContentFields(input) {
  const html = String(input || '');
  const fields = [];
  const stack = [];
  const counts = { title: 0, text: 0, image: 0, link: 0 };
  let ordinal = 0;
  for (const token of html.matchAll(TOKENS)) {
    const raw = token[0];
    if (raw.startsWith('<!')) continue;
    const name = /^<\/?([\w:-]+)/.exec(raw)?.[1]?.toLowerCase();
    if (!name) continue;
    const rawParent = stack.findLast((node) => ['script', 'style', 'textarea', 'title'].includes(node.name));
    if (rawParent && !(raw.startsWith('</') && name === rawParent.name)) continue;
    if (raw.startsWith('</')) {
      const index = stack.findLastIndex((node) => node.name === name);
      if (index < 0) continue;
      const node = stack[index];
      stack.splice(index);
      const text = html.slice(node.contentStart, token.index);
      if (!node.blocked && !node.children && TEXT.has(name) && (text.trim() || name !== 'div' || node.label) && !/[<>]/.test(text) && !dynamic(text)) {
        const leading = text.length - text.trimStart().length;
        const value = text.trim();
        const type = /^h[1-6]$/.test(name) ? 'title' : 'text';
        const count = ++counts[type];
        fields.push({ id: `${node.ordinal}:text`, kind: 'text', label: node.label || `${type === 'title' ? '제목' : name === 'a' || name === 'button' ? '버튼 문구' : '문구'} ${count}`, start: node.contentStart + leading, end: node.contentStart + leading + value.length, raw: value, value: decode(value) });
      }
      continue;
    }
    if (stack.length) stack[stack.length - 1].children = true;
    const attributes = new Map();
    const attrTextStart = 1 + /^<([\w:-]+)/.exec(raw)[1].length;
    const attributeText = raw.slice(attrTextStart);
    for (const match of attributeText.matchAll(/([^\s=<>/]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g)) {
      const key = match[1].toLowerCase();
      const quoted = /^["']/.test(match[2]);
      const offset = token.index + attrTextStart + match.index + match[0].indexOf('=') + 1;
      const valueStart = offset + /^\s*/.exec(html.slice(offset))[0].length + (quoted ? 1 : 0);
      // Duplicate attributes are ambiguous in HTML; do not expose them.
      attributes.set(key, attributes.has(key) ? null : { start: valueStart, end: valueStart + match[2].length - (quoted ? 2 : 0), raw: quoted ? match[2].slice(1, -1) : match[2], quoted });
    }
    const blocked = stack.some((node) => node.blocked) || BLOCKED.has(name)
      || /\shidden(?:\s|=|>)/i.test(raw) || attributes.get('aria-hidden')?.raw === 'true';
    const node = { name, ordinal: ordinal++, contentStart: token.index + raw.length, blocked, children: false, label: decode(attributes.get('data-pagero-label')?.raw || '') };
    const addAttribute = (attribute, kind, label) => {
      const attr = attributes.get(attribute);
      if (blocked || !attr?.quoted || dynamic(attr.raw)) return;
      fields.push({ id: `${node.ordinal}:${attribute}`, kind, label: node.label || label, ...attr, value: decode(attr.raw) });
    };
    if (name === 'img' && !attributes.has('srcset') && !stack.some((parent) => parent.name === 'picture')) addAttribute('src', 'image', `사진 ${++counts.image}`);
    if (name === 'a') addAttribute('href', 'link', `버튼 링크 ${++counts.link}`);
    if (!VOID.has(name) && !raw.endsWith('/>')) stack.push(node);
  }
  return fields.sort((a, b) => a.start - b.start);
}

export function updateCodeContentField(html, fieldId, value) {
  const source = String(html || '');
  const field = readCodeContentFields(source).find((item) => item.id === fieldId);
  if (!field) return source;
  if (field.kind === 'link' && /^(?:javascript|data|vbscript):/i.test(String(value).replace(/[\s\u0000-\u001f]/g, ''))) return source;
  return source.slice(0, field.start) + escape(value) + source.slice(field.end);
}

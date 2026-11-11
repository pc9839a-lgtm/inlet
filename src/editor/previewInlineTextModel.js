// Editor-only, lossless quick-edit boundary for plain text and hero blocks.
// Formatted HTML stays in the existing RichField/Inspector editor.
const EDITABLE_FIELDS = new Set(['title', 'body']);
const HTML_TAG = /<\/?[a-z][^>]*>/i;
const BR_TAG = /<br\s*\/?>/gi;
const HTML_ENTITY = /&(#(?:x[0-9a-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi;
const NAMED_ENTITY = /&([a-z][a-z0-9]+);/gi;
const SAFE_NAMED_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos', 'nbsp']);

export function canInlineEditTextMarkup(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (HTML_TAG.test(value.replace(BR_TAG, ''))) return false;
  const named = value.matchAll(NAMED_ENTITY);
  for (const match of named) {
    if (!SAFE_NAMED_ENTITIES.has(match[1].toLowerCase())) return false;
  }
  return true;
}

export function decodeInlineTextMarkup(value) {
  return String(value ?? '').replace(BR_TAG, '\n').replace(HTML_ENTITY, (entity, raw) => {
    const part = raw.toLowerCase();
    if (part.startsWith('#')) {
      const hex = part.startsWith('#x');
      const number = Number.parseInt(part.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(number) && number > 0 && number <= 0x10ffff
        && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number) : entity;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[part] ?? entity;
  });
}

export function encodeInlineTextMarkup(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br>');
}

// A functional page updater prevents replacing a newer Inspector or upload edit.
// Never writes a different page, field, block type, or formatted rich content.
export function patchInlineTextBlock(page, { blockId, field, previousHtml, nextHtml } = {}) {
  if (!page || !Array.isArray(page.blocks) || !EDITABLE_FIELDS.has(field)
    || typeof nextHtml !== 'string' || !canInlineEditTextMarkup(previousHtml)
    || (nextHtml !== '' && !canInlineEditTextMarkup(nextHtml))) return page;
  const index = page.blocks.findIndex((block) => block?.id === blockId && ['text', 'hero'].includes(block?.type));
  if (index < 0) return page;
  const previous = page.blocks[index];
  if (String(previous.s?.[field] ?? '') !== previousHtml || previousHtml === nextHtml) return page;
  const blocks = [...page.blocks];
  blocks[index] = { ...previous, s: { ...previous.s, [field]: nextHtml } };
  return { ...page, blocks };
}

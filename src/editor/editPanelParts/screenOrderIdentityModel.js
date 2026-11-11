// Read-only display identity for ScreenOrder rows. Never writes into page blocks.
// Page model defaults an absent visible flag to true; only explicit false hides a block.
export function isExplicitlyHidden(block) {
  return block?.visible === false;
}
function previewText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

// Code blocks on long pages are often numbered but have no editorLabel.
// Extract only visible markup text for the navigator; never render raw HTML,
// execute embedded code, or persist this derived label into the page schema.
// Limit processing of giant snippets to keep a large composition responsive.
function previewCodeContent(value) {
  if (typeof value !== 'string' || !value) return '';
  const excerpt = value.slice(0, 20000);
  const visibleMarkup = excerpt
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ');
  return previewText(visibleMarkup);
}

function blockVisualType(block) {
  return block?.s?.widgetMode === 'youtube' ? 'youtube' : block?.type || '';
}

function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^\/(?!\/)[^\s]*$/.test(url)) return url;
  if (/^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  return '';
}

function previewThumbnail(block) {
  const s = block?.s || {};
  if (!['image', 'hero'].includes(block?.type)) return '';
  const galleryFirst = Array.isArray(s.gallery) ? s.gallery[0] : null;
  const gallerySrc = typeof galleryFirst === 'string'
    ? galleryFirst
    : galleryFirst?.url || galleryFirst?.src || galleryFirst?.image || '';
  const primary = block.type === 'image' && s.mode === 'gallery'
    ? gallerySrc || s.image
    : s.image || gallerySrc;
  return safeImageUrl(primary);
}

export function createScreenOrderIdentities(blocks) {
  const items = Array.isArray(blocks) ? blocks : [];
  const totals = new Map();
  for (const block of items) {
    const kind = blockVisualType(block);
    totals.set(kind, (totals.get(kind) || 0) + 1);
  }
  const seen = new Map();
  return items.map((block) => {
    const kind = blockVisualType(block);
    const occurrence = (seen.get(kind) || 0) + 1;
    seen.set(kind, occurrence);
    const s = block?.s || {};
    const customLabel = ['code', 'image'].includes(block?.type) ? previewText(s.editorLabel) : '';
    const fields = block?.type === 'image'
      ? [s.caption, s.alt]
      : block?.type === 'code'
        ? [s.widgetMode === 'youtube' ? '' : previewCodeContent(s.html)]
        : [s.title, s.heading, s.label, s.caption];
    const detail = fields.map(previewText).find(Boolean) || '';
    // Put the visitor-facing content before the technical block type.
    // Read-only derivation: editing, search, undo and publishing use the
    // original block model; never store these labels in page data.
    const itemList = Array.isArray(s.items) ? s.items : [];
    const contentTitle = ({
      hero: previewText(s.title),
      text: previewText(s.title || s.body),
      form: previewText(s.title),
      links: previewText(s.title || itemList[0]?.label || itemList[0]?.title || itemList[0]?.text),
      cards: previewText(s.title || itemList[0]?.title),
      faq: previewText(s.title || itemList[0]?.question),
      schedule: previewText(s.title),
      download: previewText(s.title),
    })[block?.type] || '';
    const contentSummary = ({
      hero: previewText(s.body),
      text: previewText(s.title ? s.body : ''),
      form: [Array.isArray(s.questions) ? `질문 ${s.questions.length}개` : '', previewText(s.submit)].filter(Boolean).join(' · '),
      links: itemList.length ? `링크 ${itemList.length}개` : '',
      cards: itemList.length ? `항목 ${itemList.length}개` : '',
      faq: itemList.length ? `질문 ${itemList.length}개` : '',
      schedule: previewText(s.desc),
      download: previewText(s.desc),
    })[block?.type] || '';
    return {
      repeated: (totals.get(kind) || 0) > 1,
      occurrence,
      customLabel,
      detail,
      contentTitle,
      contentSummary,
      thumbnail: previewThumbnail(block),
    };
  });
}

// Read-only display identity for ScreenOrder rows. Never writes into page blocks.
function previewText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function blockVisualType(block) {
  return block?.s?.widgetMode === 'youtube' ? 'youtube' : block?.type || '';
}

function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (/^https?:\\/\\/[^\\s]+$/i.test(url)) return url;
  if (/^\\/(?!\\/)[^\\s]*$/.test(url)) return url;
  if (/^data:image\\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(url)) return url;
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
    const customLabel = block?.type === 'code' ? previewText(s.editorLabel) : '';
    const fields = block?.type === 'image'
      ? [s.caption, s.alt]
      : block?.type === 'code'
        ? []
        : [s.title, s.heading, s.label, s.caption];
    const detail = fields.map(previewText).find(Boolean) || '';
    return {
      repeated: (totals.get(kind) || 0) > 1,
      occurrence,
      customLabel,
      detail,
      thumbnail: previewThumbnail(block),
    };
  });
}

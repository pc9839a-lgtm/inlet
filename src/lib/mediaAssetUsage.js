function lowerEncodedEscapes(value = '') {
  return String(value || '').replace(/%[0-9A-F]{2}/g, (match) => match.toLowerCase());
}

export function assetReferenceNeedles(key = '') {
  const safeKey = String(key || '').trim();
  if (!safeKey) return [];
  const encoded = encodeURIComponent(safeKey);
  return [...new Set([safeKey, encoded, lowerEncodedEscapes(encoded)])];
}

export function pageReferencesAssetKey(page = {}, key = '') {
  const needles = assetReferenceNeedles(key);
  if (!needles.length) return false;
  let raw = '';
  try {
    raw = JSON.stringify(page || {});
  } catch {
    return false;
  }
  return needles.some((needle) => raw.includes(needle));
}

const D1_PAGE_JSON_SAFE_BYTES = 1_750_000;
const DATA_IMAGE_TOTAL_TARGET_BYTES = 600_000;
const DATA_IMAGE_MAX_TARGET_BYTES = 240_000;
const DATA_IMAGE_MIN_TARGET_BYTES = 72_000;
const IMAGE_MAX_DIMENSION = 1600;

function utf8Bytes(value = '') {
  return new TextEncoder().encode(String(value || '')).length;
}

function isDataImage(value) {
  return typeof value === 'string' && /^data:image\//i.test(value);
}

function dataImageValues(value, found = new Set()) {
  if (isDataImage(value)) {
    found.add(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) dataImageValues(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) dataImageValues(item, found);
  }
  return found;
}

function replaceDataImages(value, replacements) {
  if (isDataImage(value)) return replacements.get(value) || value;
  if (Array.isArray(value)) return value.map((item) => replaceDataImages(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceDataImages(item, replacements)]));
  }
  return value;
}

function loadDataImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    image.src = source;
  });
}

function canvasDataUrl(canvas, quality) {
  const webp = canvas.toDataURL('image/webp', quality);
  if (/^data:image\/webp/i.test(webp)) return webp;
  return canvas.toDataURL('image/jpeg', quality);
}

async function optimizeDataImage(source, targetBytes) {
  if (utf8Bytes(source) <= targetBytes) return source;
  if (typeof document === 'undefined' || typeof Image === 'undefined') return source;

  const image = await loadDataImage(source);
  const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
  const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
  const initialScale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let width = Math.max(1, Math.round(sourceWidth * initialScale));
  let height = Math.max(1, Math.round(sourceHeight * initialScale));
  let smallest = source;

  for (let pass = 0; pass < 5; pass += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return smallest;
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const candidate = canvasDataUrl(canvas, quality);
      if (utf8Bytes(candidate) < utf8Bytes(smallest)) smallest = candidate;
      if (utf8Bytes(candidate) <= targetBytes) return candidate;
    }

    width = Math.max(320, Math.round(width * 0.78));
    height = Math.max(180, Math.round(height * 0.78));
  }
  return smallest;
}

export function pageJsonBytes(page = {}) {
  return utf8Bytes(JSON.stringify(page || {}));
}

export async function optimizePageForServerSave(page = {}) {
  if (pageJsonBytes(page) <= D1_PAGE_JSON_SAFE_BYTES) return page;

  const images = [...dataImageValues(page)];
  if (!images.length) {
    const error = new Error('페이지 데이터가 서버 저장 한도를 초과했습니다. 불필요한 위젯 내용을 줄인 뒤 다시 저장해주세요.');
    error.status = 413;
    error.details = { code: 'PAGE_DATA_TOO_LARGE', bytes: pageJsonBytes(page) };
    throw error;
  }

  const targetBytes = Math.max(
    DATA_IMAGE_MIN_TARGET_BYTES,
    Math.min(DATA_IMAGE_MAX_TARGET_BYTES, Math.floor(DATA_IMAGE_TOTAL_TARGET_BYTES / images.length)),
  );
  const replacements = new Map();
  for (const source of images) {
    try {
      replacements.set(source, await optimizeDataImage(source, targetBytes));
    } catch {
      replacements.set(source, source);
    }
  }

  const optimized = replaceDataImages(page, replacements);
  const bytes = pageJsonBytes(optimized);
  if (bytes > D1_PAGE_JSON_SAFE_BYTES) {
    const error = new Error('이미지 용량이 서버 저장 한도를 초과했습니다. 큰 이미지나 갤러리 이미지를 줄인 뒤 다시 저장해주세요.');
    error.status = 413;
    error.details = { code: 'PAGE_DATA_TOO_LARGE', bytes };
    throw error;
  }
  return optimized;
}
const IMAGE_DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=\s]+)$/;
const IMAGE_EXTENSION = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
});
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES_PER_SAVE = 100;
const MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024;

function pageAssetError(message, status = 503, code = 'PAGE_IMAGE_STORAGE_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = { code, ...details };
  return error;
}

function pageAssetBucket(env = {}) {
  const bucket = env.FILES_BUCKET || env.INLET_FILES_BUCKET || env.R2_FILES || env.FILES;
  return bucket && typeof bucket.put === 'function' ? bucket : null;
}

function safeProjectId(project = {}) {
  return String(project.projectId || project.id || 'public')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80) || 'public';
}

function decodeBase64(value = '') {
  const clean = String(value || '').replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicAssetUrl(key = '') {
  return `/api/files/download?key=${encodeURIComponent(key)}`;
}

function containsEmbeddedImage(value) {
  if (typeof value === 'string') return value.startsWith('data:image/');
  if (Array.isArray(value)) return value.some(containsEmbeddedImage);
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(containsEmbeddedImage);
}

async function storeEmbeddedImage(dataUrl, state) {
  if (state.cache.has(dataUrl)) return state.cache.get(dataUrl);

  const match = String(dataUrl || '').match(IMAGE_DATA_URL_RE);
  if (!match) return dataUrl;

  const contentType = match[1].toLowerCase();
  const extension = IMAGE_EXTENSION[contentType];
  if (!extension) return dataUrl;

  let bytes;
  try {
    bytes = decodeBase64(match[2]);
  } catch {
    throw pageAssetError('페이지 이미지 데이터를 읽지 못했습니다.', 400, 'PAGE_IMAGE_DATA_INVALID');
  }

  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw pageAssetError(
      '페이지 이미지가 저장 허용 크기를 초과했습니다. 이미지를 다시 선택해주세요.',
      413,
      'PAGE_IMAGE_TOO_LARGE',
      { maxBytes: MAX_IMAGE_BYTES },
    );
  }

  if (state.replaced + 1 > MAX_IMAGES_PER_SAVE) {
    throw pageAssetError(
      `한 번에 저장할 수 있는 페이지 이미지는 최대 ${MAX_IMAGES_PER_SAVE}개입니다.`,
      413,
      'PAGE_IMAGE_COUNT_LIMIT',
      { maxImages: MAX_IMAGES_PER_SAVE },
    );
  }
  if (state.totalBytes + bytes.byteLength > MAX_TOTAL_IMAGE_BYTES) {
    throw pageAssetError(
      '한 번에 저장할 페이지 이미지 용량이 너무 큽니다. 이미지를 줄여서 다시 저장해주세요.',
      413,
      'PAGE_IMAGE_TOTAL_LIMIT',
      { maxBytes: MAX_TOTAL_IMAGE_BYTES },
    );
  }

  const hash = await sha256Hex(bytes);
  const key = `${state.projectId}/images/${hash}.${extension}`;
  const url = publicAssetUrl(key);

  let exists = false;
  if (typeof state.bucket.head === 'function') {
    try {
      exists = !!(await state.bucket.head(key));
    } catch {
      exists = false;
    }
  }

  if (!exists) {
    try {
      await state.bucket.put(key, bytes, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          purpose: 'page-image',
          projectId: state.projectId,
          sha256: hash,
          uploadedAt: new Date().toISOString(),
        },
      });
      state.uploaded += 1;
    } catch {
      throw pageAssetError('페이지 이미지를 파일 저장소에 보관하지 못했습니다. 잠시 후 다시 저장해주세요.');
    }
  }

  state.replaced += 1;
  state.totalBytes += bytes.byteLength;
  state.cache.set(dataUrl, url);
  return url;
}

async function externalizeValue(value, state) {
  if (typeof value === 'string') {
    return value.startsWith('data:image/') ? storeEmbeddedImage(value, state) : value;
  }
  if (Array.isArray(value)) {
    const next = [];
    for (const item of value) next.push(await externalizeValue(item, state));
    return next;
  }
  if (!value || typeof value !== 'object') return value;

  const next = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = await externalizeValue(item, state);
  }
  return next;
}

export async function externalizeEmbeddedPageImages(page = {}, env = {}, project = {}) {
  if (!containsEmbeddedImage(page)) {
    return { page, replaced: 0, uploaded: 0, totalBytes: 0 };
  }

  const bucket = pageAssetBucket(env);
  if (!bucket) {
    throw pageAssetError('페이지 이미지 저장소가 준비되지 않았습니다. 잠시 후 다시 저장해주세요.');
  }

  const state = {
    bucket,
    projectId: safeProjectId(project),
    cache: new Map(),
    replaced: 0,
    uploaded: 0,
    totalBytes: 0,
  };
  const nextPage = await externalizeValue(page, state);
  return {
    page: nextPage,
    replaced: state.replaced,
    uploaded: state.uploaded,
    totalBytes: state.totalBytes,
  };
}

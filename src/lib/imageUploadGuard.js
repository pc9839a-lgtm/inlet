export const IMAGE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const IMAGE_UPLOAD_WARN_BYTES = 1200 * 1024;

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0KB';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
  return `${Math.ceil(value / 1024)}KB`;
}

export function estimatedDataUrlBytes(file = {}) {
  return Math.ceil(Number(file.size || 0) / 3) * 4 + 96;
}

export function validateImageUpload(file, options = {}) {
  if (!file) return { ok: false, reason: 'empty', message: '이미지를 선택해주세요.' };
  if (!String(file.type || '').startsWith('image/')) {
    return { ok: false, reason: 'type', message: '이미지 파일만 업로드할 수 있습니다.' };
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      reason: 'size',
      message: `이미지는 1장당 ${formatBytes(IMAGE_UPLOAD_MAX_BYTES)} 이하로 업로드해주세요. 현재 파일은 ${formatBytes(file.size)}입니다.`,
    };
  }

  const estimatedBytes = estimatedDataUrlBytes(file);
  const warnAt = Number(options.warnAt || IMAGE_UPLOAD_WARN_BYTES);
  const warning = estimatedBytes >= warnAt
    ? `이 이미지는 저장 공간을 약 ${formatBytes(estimatedBytes)} 차지합니다. 이미지가 많으면 브라우저 저장 공간이 부족해질 수 있습니다.`
    : '';

  return { ok: true, warning, estimatedBytes };
}

export function isStoredDataImage(value) {
  return typeof value === 'string' && /^data:image\//i.test(value);
}

export function storedDataImageBytes(value) {
  if (!isStoredDataImage(value)) return 0;
  const data = String(value);
  const comma = data.indexOf(',');
  if (comma < 0) return data.length;
  const header = data.slice(0, comma);
  const payload = data.slice(comma + 1);
  if (/;base64/i.test(header)) {
    const clean = payload.replace(/\s/g, '');
    const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
  }
  try {
    return new Blob([decodeURIComponent(payload)]).size;
  } catch {
    return payload.length;
  }
}

export function storedImageStorageInfo(value, warnAt = IMAGE_UPLOAD_WARN_BYTES) {
  const bytes = storedDataImageBytes(value);
  return {
    stored: bytes > 0,
    bytes,
    label: formatBytes(bytes),
    heavy: bytes >= warnAt,
  };
}

export function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

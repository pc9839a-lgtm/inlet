export const IMAGE_UPLOAD_SOURCE_MAX_BYTES = 12 * 1024 * 1024;
export const IMAGE_UPLOAD_MAX_BYTES = 1200 * 1024;
export const IMAGE_UPLOAD_WARN_BYTES = 900 * 1024;
export const IMAGE_UPLOAD_MAX_DIMENSION = 1920;
export const IMAGE_UPLOAD_MIN_DIMENSION = 720;

const OPTIMIZABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PASSTHROUGH_TYPES = new Set(['image/gif']);
const ACCEPTED_TYPES = new Set([...OPTIMIZABLE_TYPES, ...PASSTHROUGH_TYPES]);

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
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) {
    return { ok: false, reason: 'type', message: '이미지 파일만 업로드할 수 있습니다.' };
  }
  if (!ACCEPTED_TYPES.has(type)) {
    return {
      ok: false,
      reason: 'format',
      message: 'JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다. HEIC·SVG 파일은 먼저 JPG 또는 PNG로 변환해주세요.',
    };
  }

  const sourceMaxBytes = Number(options.sourceMaxBytes || IMAGE_UPLOAD_SOURCE_MAX_BYTES);
  if (file.size > sourceMaxBytes) {
    return {
      ok: false,
      reason: 'source-size',
      message: `원본 이미지는 1장당 ${formatBytes(sourceMaxBytes)} 이하로 선택해주세요. 현재 파일은 ${formatBytes(file.size)}입니다.`,
    };
  }

  if (PASSTHROUGH_TYPES.has(type) && file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      reason: 'animated-size',
      message: `움직이는 GIF는 자동 압축되지 않습니다. ${formatBytes(IMAGE_UPLOAD_MAX_BYTES)} 이하 파일을 사용해주세요.`,
    };
  }

  const estimatedBytes = estimatedDataUrlBytes(file);
  const warnAt = Number(options.warnAt || IMAGE_UPLOAD_WARN_BYTES);
  const warning = estimatedBytes >= warnAt
    ? `업로드 후 자동으로 방향과 크기를 보정하고 ${formatBytes(IMAGE_UPLOAD_MAX_BYTES)} 이하로 최적화합니다.`
    : '';

  return { ok: true, warning, estimatedBytes, optimizable: OPTIMIZABLE_TYPES.has(type) };
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

export function imageDataFingerprint(value = '') {
  const source = String(value || '');
  if (!source) return '';
  let hash = 2166136261;
  const stride = Math.max(1, Math.floor(source.length / 4096));
  for (let index = 0; index < source.length; index += stride) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= source.length;
  return `${source.slice(0, 28)}:${source.length}:${(hash >>> 0).toString(36)}`;
}

export function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return readImageFileAsDataUrl(blob);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('이미지를 압축하지 못했습니다.'));
    }, type, quality);
  });
}

async function decodeImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close: () => bitmap.close?.(),
        };
      } catch {
        // Fall through to the HTMLImageElement decoder.
      }
    }
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('현재 브라우저에서 이미지 방향과 크기를 처리할 수 없습니다.');
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  try {
    if (image.decode) await image.decode();
    else await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function targetDimensions(width, height, maxDimension) {
  const safeWidth = Math.max(1, Number(width || 1));
  const safeHeight = Math.max(1, Number(height || 1));
  const ratio = Math.min(1, maxDimension / Math.max(safeWidth, safeHeight));
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

function supportsWebp(canvas) {
  try {
    return canvas.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
  } catch {
    return false;
  }
}

function drawImage(canvas, context, source, width, height, type) {
  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(source, 0, 0, width, height);
}

export async function optimizeImageFileForStorage(file, options = {}) {
  const validation = validateImageUpload(file, options);
  if (!validation.ok) {
    const error = new Error(validation.message);
    error.code = validation.reason;
    throw error;
  }

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const sourceBytes = Number(file.size || 0);
  onProgress({ stage: 'reading', progress: 8, label: '이미지 확인 중' });

  if (!validation.optimizable) {
    const dataUrl = await readImageFileAsDataUrl(file);
    const finalBytes = storedDataImageBytes(dataUrl);
    onProgress({ stage: 'done', progress: 100, label: '업로드 준비 완료' });
    return {
      dataUrl,
      originalBytes: sourceBytes,
      finalBytes,
      width: 0,
      height: 0,
      type: String(file.type || ''),
      compressed: false,
      savedBytes: Math.max(0, sourceBytes - finalBytes),
      fingerprint: imageDataFingerprint(dataUrl),
    };
  }

  if (typeof document === 'undefined') {
    throw new Error('이미지 최적화는 브라우저에서만 사용할 수 있습니다.');
  }

  const decoded = await decodeImageSource(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    decoded.close?.();
    throw new Error('이미지 처리 공간을 만들지 못했습니다. 브라우저를 다시 실행해주세요.');
  }

  const maxDimension = Number(options.maxDimension || IMAGE_UPLOAD_MAX_DIMENSION);
  const minDimension = Number(options.minDimension || IMAGE_UPLOAD_MIN_DIMENSION);
  const targetBytes = Number(options.targetBytes || IMAGE_UPLOAD_WARN_BYTES);
  const maxBytes = Number(options.maxBytes || IMAGE_UPLOAD_MAX_BYTES);
  let dimensions = targetDimensions(decoded.width, decoded.height, maxDimension);
  const outputType = supportsWebp(canvas) ? 'image/webp' : (String(file.type || '') === 'image/png' ? 'image/png' : 'image/jpeg');
  const qualities = outputType === 'image/png' ? [undefined] : [0.86, 0.78, 0.7, 0.62, 0.54];
  let bestBlob = null;
  let bestDimensions = dimensions;

  try {
    for (let resizePass = 0; resizePass < 5; resizePass += 1) {
      onProgress({
        stage: 'optimizing',
        progress: 24 + (resizePass * 12),
        label: resizePass === 0 ? '크기·방향 보정 중' : '용량 줄이는 중',
      });
      drawImage(canvas, context, decoded.source, dimensions.width, dimensions.height, outputType);

      for (let qualityIndex = 0; qualityIndex < qualities.length; qualityIndex += 1) {
        const blob = await canvasToBlob(canvas, outputType, qualities[qualityIndex]);
        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
          bestDimensions = { ...dimensions };
        }
        if (blob.size <= targetBytes) {
          bestBlob = blob;
          bestDimensions = { ...dimensions };
          break;
        }
      }

      if (bestBlob?.size <= maxBytes) break;
      const longest = Math.max(dimensions.width, dimensions.height);
      if (longest <= minDimension) break;
      dimensions = targetDimensions(dimensions.width, dimensions.height, Math.max(minDimension, Math.round(longest * 0.82)));
    }
  } finally {
    decoded.close?.();
  }

  if (!bestBlob || bestBlob.size > maxBytes) {
    throw new Error(`이미지를 ${formatBytes(maxBytes)} 이하로 줄이지 못했습니다. 더 작은 이미지로 다시 시도해주세요.`);
  }

  onProgress({ stage: 'encoding', progress: 88, label: '저장 형식으로 변환 중' });
  const dataUrl = await blobToDataUrl(bestBlob);
  const finalBytes = storedDataImageBytes(dataUrl);
  onProgress({ stage: 'done', progress: 100, label: '최적화 완료' });

  return {
    dataUrl,
    originalBytes: sourceBytes,
    finalBytes,
    width: bestDimensions.width,
    height: bestDimensions.height,
    type: bestBlob.type || outputType,
    compressed: finalBytes < sourceBytes || bestDimensions.width !== decoded.width || bestDimensions.height !== decoded.height,
    savedBytes: Math.max(0, sourceBytes - finalBytes),
    fingerprint: imageDataFingerprint(dataUrl),
  };
}

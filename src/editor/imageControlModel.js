import {
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimatedDataUrlBytes,
  formatBytes,
  imageDataFingerprint,
  optimizeImageFileForStorage,
  storedImageStorageInfo,
  validateImageUpload,
} from '../lib/imageUploadGuard.js';
import { notify } from '../lib/uiFeedback.js';

export {
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  imageDataFingerprint,
};
export const IMAGE_UPLOAD_BATCH_WARN_BYTES = 4 * 1024 * 1024;

export function formatFileSize(bytes = 0) {
  return formatBytes(bytes);
}

export function estimateImageStorageBytes(file) {
  return estimatedDataUrlBytes(file);
}

export function storedImageInfo(value) {
  return storedImageStorageInfo(value);
}

export function storedImagesSummary(images = []) {
  const items = images
    .map((value, index) => ({ index, fingerprint: imageDataFingerprint(value), ...storedImageInfo(value) }))
    .filter((item) => item.stored);
  const bytes = items.reduce((sum, item) => sum + item.bytes, 0);
  const seen = new Set();
  const duplicates = items.filter((item) => {
    if (!item.fingerprint) return false;
    if (seen.has(item.fingerprint)) return true;
    seen.add(item.fingerprint);
    return false;
  });
  return {
    items,
    bytes,
    label: formatFileSize(bytes),
    heavyItems: items.filter((item) => item.heavy),
    duplicates,
  };
}

export function imageUploadError(file) {
  const result = validateImageUpload(file);
  return result.ok ? '' : result.message;
}

export function warnImageStorageUse(files, context = '이미지') {
  const list = Array.from(files || []);
  if (!list.length) return;
  const sourceBytes = list.reduce((sum, file) => sum + Number(file?.size || 0), 0);
  const large = list.find((file) => Number(file?.size || 0) >= IMAGE_UPLOAD_WARN_BYTES);
  if (sourceBytes >= IMAGE_UPLOAD_BATCH_WARN_BYTES) {
    notify(`${context} 원본 ${formatFileSize(sourceBytes)}를 자동으로 크기·방향 보정 후 압축합니다. 처리 중에는 화면을 닫지 마세요.`, 'info');
    return;
  }
  if (large) {
    notify(`${large.name || '이미지'}를 최대 ${IMAGE_UPLOAD_MAX_DIMENSION}px, ${formatFileSize(IMAGE_UPLOAD_MAX_BYTES)} 이하로 자동 최적화합니다.`, 'info');
  }
}

export function prepareEditorImageFile(file, options = {}) {
  return optimizeImageFileForStorage(file, options);
}

export async function readEditorImageFile(file, options = {}) {
  const result = await prepareEditorImageFile(file, options);
  return result.dataUrl;
}

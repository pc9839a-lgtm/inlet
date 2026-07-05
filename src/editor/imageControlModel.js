import {
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimatedDataUrlBytes,
  formatBytes,
  readImageFileAsDataUrl,
  storedImageStorageInfo,
  validateImageUpload,
} from '../lib/imageUploadGuard.js';
import { notify } from '../lib/uiFeedback.js';

export { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_WARN_BYTES };
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
    .map((value, index) => ({ index, ...storedImageInfo(value) }))
    .filter((item) => item.stored);
  const bytes = items.reduce((sum, item) => sum + item.bytes, 0);
  return {
    items,
    bytes,
    label: formatFileSize(bytes),
    heavyItems: items.filter((item) => item.heavy),
  };
}

export function imageUploadError(file) {
  const result = validateImageUpload(file);
  return result.ok ? '' : result.message;
}

export function warnImageStorageUse(files, context = '이미지') {
  const list = Array.from(files || []);
  if (!list.length) return;
  const estimated = list.reduce((sum, file) => sum + estimateImageStorageBytes(file), 0);
  const large = list.find((file) => estimateImageStorageBytes(file) >= IMAGE_UPLOAD_WARN_BYTES);
  if (estimated >= IMAGE_UPLOAD_BATCH_WARN_BYTES) {
    notify(`${context}가 브라우저 저장 공간을 약 ${formatFileSize(estimated)} 사용합니다. 저장 실패가 반복되면 이미지를 줄여주세요.`, 'warning');
    return;
  }
  if (large) {
    notify(`${large.name || '이미지'} 저장에 약 ${formatFileSize(estimateImageStorageBytes(large))}가 필요합니다. 이미지가 많으면 저장 공간이 부족할 수 있습니다.`, 'warning');
  }
}

export function readEditorImageFile(file) {
  return readImageFileAsDataUrl(file);
}
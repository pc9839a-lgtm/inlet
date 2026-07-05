import { imageUploadError, warnImageStorageUse } from '../controls.jsx';

export function getGalleryUploadRemain(count = 0, max = 10) {
  return Math.max(0, max - count);
}

export function normalizeGalleryFiles(files) {
  return Array.from(files || []);
}

export function getInvalidGalleryFile(files = []) {
  const file = files.find((candidate) => imageUploadError(candidate));
  return file ? { file, message: imageUploadError(file) } : null;
}

export function limitGalleryFiles(files = [], remain = 0) {
  return files.slice(0, remain);
}

export function warnGalleryStorageUse(files = []) {
  warnImageStorageUse(files, `갤러리 이미지 ${files.length}장`);
}

export function resetGalleryInput(inputRef) {
  if (inputRef.current) inputRef.current.value = '';
}

export function galleryFullMessage(max) {
  return `갤러리는 최대 ${max}장까지 등록할 수 있습니다.`;
}

export function galleryTruncatedMessage(max, remain) {
  return `최대 ${max}장까지만 등록됩니다. ${remain}장만 추가했습니다.`;
}
import { imageUploadError, storedImageInfo, warnImageStorageUse } from '../controls.jsx';

export function getLinkThumbStorage(thumb) {
  return storedImageInfo(thumb);
}

export function validateLinkThumbFile(file) {
  const error = imageUploadError(file);
  return error ? { ok: false, message: error } : { ok: true };
}

export function warnLinkThumbStorage(file) {
  warnImageStorageUse([file], '링크 썸네일');
}

export function resetLinkThumbInput(uploadRef) {
  if (uploadRef.current) uploadRef.current.value = '';
}

export function createAutoLinkThumbPatch(item = {}, preview = {}) {
  const patch = { iconMode: 'thumb', thumb: preview.image || '' };
  if ((!item.label || item.label === '새 링크') && preview.title) patch.label = preview.title;
  return patch;
}

export function createUploadedLinkThumbPatch(dataUrl) {
  return { iconMode: 'thumb', thumb: dataUrl };
}

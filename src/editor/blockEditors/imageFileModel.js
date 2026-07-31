import { prepareEditorImageFile } from '../imageControlModel.js';

export async function prepareGalleryImageFile(file, options = {}) {
  return prepareEditorImageFile(file, options);
}

export async function readImageFile(file, options = {}) {
  const result = await prepareGalleryImageFile(file, options);
  return result.dataUrl;
}

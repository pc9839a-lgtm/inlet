import { formatFileSize } from '../controls.jsx';
import {
  DOWNLOAD_ALLOWED_EXTENSIONS,
  DOWNLOAD_MAX_BYTES,
  extensionFromName,
} from './downloadEditorModel.js';

export function validateDownloadUploadFile(file) {
  const extension = extensionFromName(file?.name);
  if (!DOWNLOAD_ALLOWED_EXTENSIONS.includes(extension)) {
    return { ok: false, message: 'PDF, PPT, 엑셀 파일만 업로드할 수 있습니다.' };
  }
  if (file.size > DOWNLOAD_MAX_BYTES) {
    return { ok: false, message: '파일은 20MB 이하만 업로드할 수 있습니다.' };
  }
  return { ok: true, extension };
}

export function createDownloadUploadPatch(file, item = {}, extension = extensionFromName(file?.name)) {
  return {
    fileName: file.name,
    extension,
    badge: extension.toUpperCase(),
    sizeLabel: formatFileSize(file.size),
    fileBytes: file.size,
    title: item.title && item.title !== '자료' ? item.title : file.name.replace(/\.[^.]+$/, ''),
  };
}

export function clearDownloadUploadPatch() {
  return { fileName: '', fileUrl: '', sizeLabel: '' };
}

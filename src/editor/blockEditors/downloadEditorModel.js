import { pickSafe, uid } from '../../lib/pageModel.js';

export const DOWNLOAD_ALLOWED_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'xls', 'xlsx'];

export const DOWNLOAD_FILE_ACCEPT = [
  '.pdf',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

export const DOWNLOAD_MAX_BYTES = 20 * 1024 * 1024;

export function extensionFromName(name = '') {
  return String(name).split('.').pop()?.toLowerCase() || 'pdf';
}

export function normalizeDownloadItem(item = {}, index = 0) {
  const extension = pickSafe(
    String(item.extension || extensionFromName(item.fileName)).replace(/^\./, '').toLowerCase(),
    DOWNLOAD_ALLOWED_EXTENSIONS,
    'pdf'
  );
  return {
    id: item.id || uid(),
    badge: item.badge || extension.toUpperCase(),
    title: item.title || item.label || `자료 ${index + 1}`,
    desc: item.desc || '',
    fileName: item.fileName || '',
    fileUrl: item.fileUrl || item.url || '',
    extension,
    sizeLabel: item.sizeLabel || '',
  };
}

export function createDownloadItem(index = 0) {
  return normalizeDownloadItem({ id: uid(), title: '자료', extension: 'pdf', badge: 'PDF' }, index);
}
import { authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest } from '../_shared.js';

export const FILE_METHODS = 'GET, POST, OPTIONS';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_PROJECT_MAX_BYTES = 100 * 1024 * 1024;
export const DEFAULT_PROJECT_MAX_FILES = 20;
export const ALLOWED_EXTENSIONS = new Set(['pdf', 'ppt', 'pptx', 'xls', 'xlsx']);
export const CONTENT_TYPES = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function fileBucket(env = {}) {
  const bucket = env.FILES_BUCKET || env.INLET_FILES_BUCKET || env.R2_FILES || env.FILES;
  if (!bucket || typeof bucket.put !== 'function' || typeof bucket.get !== 'function') {
    const error = new Error('R2 파일 저장소 바인딩(FILES_BUCKET)이 설정되지 않았습니다.');
    error.status = 503;
    throw error;
  }
  return bucket;
}

export function extensionFromName(name = '') {
  return String(name || '').split('.').pop()?.toLowerCase() || '';
}

export function safeFileName(name = '') {
  const cleaned = String(name || 'download')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return cleaned || 'download';
}

export function assertAllowedFile(file) {
  const name = safeFileName(file?.name || '');
  const extension = extensionFromName(name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    const error = new Error('PDF, PPT, PPTX, XLS, XLSX 파일만 업로드할 수 있습니다.');
    error.status = 400;
    throw error;
  }
  if (Number(file?.size || 0) <= 0) {
    const error = new Error('빈 파일은 업로드할 수 없습니다.');
    error.status = 400;
    throw error;
  }
  if (Number(file.size || 0) > MAX_FILE_BYTES) {
    const error = new Error('파일은 20MB 이하만 업로드할 수 있습니다.');
    error.status = 413;
    throw error;
  }
  return { name, extension, contentType: CONTENT_TYPES[extension] || 'application/octet-stream' };
}

export function safeObjectKey(project = {}, extension = 'pdf') {
  const projectId = safeProjectId(project);
  const date = new Date().toISOString().slice(0, 10);
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${projectDownloadsPrefix(projectId)}${date}/${id}.${extension}`;
}

export function safeProjectId(project = {}) {
  return String(project.projectId || project.id || 'public')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80) || 'public';
}

export function projectDownloadsPrefix(projectOrId = {}) {
  const projectId = typeof projectOrId === 'string' ? projectOrId : safeProjectId(projectOrId);
  return `${projectId}/downloads/`;
}

export function projectFileLimits(env = {}) {
  const maxMb = Math.max(1, Math.min(10240, Number(env.INLET_FILES_PROJECT_MAX_MB || 100)));
  const maxFiles = Math.max(1, Math.min(1000, Number(env.INLET_FILES_PROJECT_MAX_COUNT || 20)));
  return {
    maxBytes: maxMb * 1024 * 1024,
    maxMb,
    maxFiles,
  };
}

export async function projectFileUsage(bucket, project = {}) {
  const prefix = projectDownloadsPrefix(project);
  let cursor = undefined;
  let bytes = 0;
  let count = 0;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const object of page.objects || []) {
      bytes += Number(object.size || 0);
      count += 1;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { prefix, bytes, count };
}

export async function assertProjectFileQuota(bucket, project = {}, fileSize = 0, env = {}) {
  const usage = await projectFileUsage(bucket, project);
  const limits = projectFileLimits(env);
  if (usage.count + 1 > limits.maxFiles) {
    const error = new Error(`프로젝트당 자료 파일은 최대 ${limits.maxFiles}개까지 업로드할 수 있습니다.`);
    error.status = 429;
    error.details = { code: 'FILE_PROJECT_COUNT_LIMIT', usage, limits };
    throw error;
  }
  if (usage.bytes + Number(fileSize || 0) > limits.maxBytes) {
    const error = new Error(`프로젝트당 자료 저장 용량은 최대 ${limits.maxMb}MB입니다. 기존 파일을 정리하거나 상위 플랜이 필요합니다.`);
    error.status = 429;
    error.details = { code: 'FILE_PROJECT_STORAGE_LIMIT', usage, limits };
    throw error;
  }
  return { usage, limits };
}

export function publicDownloadUrl(request, key = '') {
  const url = new URL(request.url);
  url.pathname = '/api/files/download';
  url.search = `?key=${encodeURIComponent(key)}`;
  return url.toString();
}

export function validateObjectKey(key = '') {
  const value = String(key || '').trim();
  if (!value || value.includes('..') || value.startsWith('/') || /[\\]/.test(value)) {
    const error = new Error('유효하지 않은 파일 키입니다.');
    error.status = 400;
    throw error;
  }
  return value;
}

export { authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest };

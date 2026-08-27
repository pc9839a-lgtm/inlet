import { ApiError, apiFetch, projectAuthHeaders } from './apiClient.js';
import { projectContext } from './projectContext.js';

async function uploadProjectFile(file, page = {}, authUser = null, { purpose = 'download', fileName = '' } = {}) {
  if (!file) throw new ApiError('업로드할 파일이 없습니다.', 400);
  const project = projectContext(page, authUser);
  const form = new FormData();
  form.append('file', file, fileName || file?.name || 'upload');
  form.append('purpose', purpose);
  form.append('project', JSON.stringify(project));

  const res = await apiFetch('/api/files/upload', {
    method: 'POST',
    headers: projectAuthHeaders(project, {}),
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text || `파일 업로드 실패: ${res.status}`;
    let details = null;
    try {
      details = JSON.parse(text);
      message = details.message || details.error || message;
    } catch {
      // Plain text error response.
    }
    throw new ApiError(message, res.status, details);
  }

  return res.json();
}

export async function uploadDownloadFile(file, page = {}, authUser = null) {
  return uploadProjectFile(file, page, authUser, { purpose: 'download' });
}

export async function uploadMediaFile(file, page = {}, authUser = null, fileName = '') {
  return uploadProjectFile(file, page, authUser, { purpose: 'media', fileName });
}

function isEmbeddedVideo(value = '') {
  return /^data:video\/(?:mp4|webm|ogg|x-m4v)(?:;[^,]*)?,/i.test(String(value || '').trim());
}

function videoExtensionFromMime(type = '') {
  const mime = String(type || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  return 'mp4';
}

function ensureVideoFileName(name = '', type = '') {
  const clean = String(name || '').trim() || 'page-video';
  if (/\.(mp4|webm|ogg|ogv)$/i.test(clean)) return clean;
  return `${clean}.${videoExtensionFromMime(type)}`;
}

async function dataVideoBlob(dataUrl = '') {
  const response = await fetch(String(dataUrl || ''));
  if (!response.ok) throw new ApiError('임시 영상 데이터를 읽지 못했습니다.', 400);
  const blob = await response.blob();
  if (!blob?.size) throw new ApiError('임시 영상 데이터가 비어 있습니다.', 400);
  return blob;
}

export async function externalizeEmbeddedVideos(page = {}, authUser = null) {
  const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
  const targets = blocks.filter((block) => {
    const settings = block?.s || {};
    return block?.type === 'code'
      && settings.widgetMode === 'youtube'
      && isEmbeddedVideo(settings.videoUrl || settings.youtubeUrl || '');
  });
  if (!targets.length) return page;

  const uploaded = new Map();
  const nextBlocks = [];
  for (const block of blocks) {
    const settings = block?.s || {};
    const raw = String(settings.videoUrl || settings.youtubeUrl || '');
    if (!(block?.type === 'code' && settings.widgetMode === 'youtube' && isEmbeddedVideo(raw))) {
      nextBlocks.push(block);
      continue;
    }

    let result = uploaded.get(raw);
    if (!result) {
      const blob = await dataVideoBlob(raw);
      const fileName = ensureVideoFileName(settings.videoFileName || 'page-video', blob.type);
      result = await uploadMediaFile(blob, page, authUser, fileName);
      uploaded.set(raw, result);
    }

    const url = String(result?.downloadUrl || '').trim();
    if (!url) throw new ApiError('영상 업로드 주소를 받지 못했습니다.', 502);
    nextBlocks.push({
      ...block,
      s: {
        ...settings,
        videoUrl: url,
        youtubeUrl: url,
        videoFileName: result?.fileName || settings.videoFileName || '업로드 영상',
      },
    });
  }

  return { ...page, blocks: nextBlocks };
}

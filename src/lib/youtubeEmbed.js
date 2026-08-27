const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_RE = /^\d{5,12}$/;
const VIDEO_FILE_RE = /\.(mp4|webm|ogg|ogv)$/i;
const VIDEO_DATA_RE = /^data:video\/(?:mp4|webm|ogg|x-m4v)(?:;[^,]*)?,/i;

function toUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

function escapeHtmlAttr(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getYouTubeVideoId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  const url = toUrl(raw);
  if (!url) return '';

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let id = '';

  if (host === 'youtu.be') {
    id = url.pathname.split('/').filter(Boolean)[0] || '';
  } else if (
    host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtube-nocookie.com'
    || host.endsWith('.youtube-nocookie.com')
  ) {
    if (url.pathname === '/watch') {
      id = url.searchParams.get('v') || '';
    } else {
      const [kind, candidate] = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = candidate || '';
    }
  }

  return YOUTUBE_ID_RE.test(id) ? id : '';
}

export function getYouTubeEmbedUrl(value = '') {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : '';
}

export function getVimeoVideoId(value = '') {
  const url = toUrl(value);
  if (!url) return '';

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!(host === 'vimeo.com' || host.endsWith('.vimeo.com'))) return '';

  const parts = url.pathname.split('/').filter(Boolean);
  let id = '';
  if (host === 'player.vimeo.com' && parts[0] === 'video') {
    id = parts[1] || '';
  } else {
    id = [...parts].reverse().find((part) => VIMEO_ID_RE.test(part)) || '';
  }
  return VIMEO_ID_RE.test(id) ? id : '';
}

export function getVideoSource(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (VIDEO_DATA_RE.test(raw)) {
    return {
      kind: 'file',
      src: raw,
      title: 'Video',
      embedded: true,
    };
  }

  const youtubeId = getYouTubeVideoId(raw);
  if (youtubeId) {
    return {
      kind: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
      title: 'YouTube video',
    };
  }

  const vimeoId = getVimeoVideoId(raw);
  if (vimeoId) {
    return {
      kind: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoId}?dnt=1`,
      title: 'Vimeo video',
    };
  }

  const url = toUrl(raw);
  if (url && ['http:', 'https:'].includes(url.protocol) && VIDEO_FILE_RE.test(url.pathname)) {
    return {
      kind: 'file',
      src: url.href,
      title: 'Video',
      embedded: false,
    };
  }

  return null;
}

export function isSupportedVideoUrl(value = '') {
  return !!getVideoSource(value);
}

const VIDEO_EMBED_CSS = `
.pagero-video-embed{width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:18px;background:#0f172a}
.pagero-video-embed iframe{width:100%;height:100%;display:block;border:0;background:#000}
.pagero-youtube-empty,.pagero-video-empty{width:100%;min-height:148px;display:grid;place-items:center;padding:22px;border:1px dashed #cbd5e1;border-radius:18px;background:#f8fafc;color:#64748b;font:700 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}
`;

export function createVideoCodeSettings(value = '', options = {}) {
  const raw = String(value || '').trim();
  const source = getVideoSource(raw);
  const embeddedFile = source?.kind === 'file' && source.embedded === true;
  const emptyMessage = raw ? '지원하는 동영상 주소를 입력하세요' : '동영상 주소를 입력하세요';
  let html = `<div class="pagero-video-empty">${emptyMessage}</div>`;

  if (source?.kind === 'file') {
    html = '<div class="pagero-video-empty">직접 영상 파일</div>';
  } else if (source) {
    html = `<div class="pagero-video-embed"><iframe src="${escapeHtmlAttr(source.src)}" title="${escapeHtmlAttr(source.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe></div>`;
  }

  return {
    // 기존 direct renderer를 그대로 사용한다. MP4는 별도 runtime이 원본 비율/무한루프로 보정한다.
    widgetMode: 'youtube',
    videoUrl: raw,
    youtubeUrl: embeddedFile ? '' : raw,
    videoFileName: embeddedFile ? String(options.fileName || '업로드 영상') : '',
    html,
    css: VIDEO_EMBED_CSS,
    js: '',
    runJs: false,
    height: 'auto',
  };
}

export const createYouTubeCodeSettings = createVideoCodeSettings;

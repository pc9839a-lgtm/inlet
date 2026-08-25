const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function getYouTubeVideoId(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
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
        if (['shorts', 'embed', 'live'].includes(kind)) id = candidate || '';
      }
    }

    return YOUTUBE_ID_RE.test(id) ? id : '';
  } catch {
    return '';
  }
}

export function getYouTubeEmbedUrl(value = '') {
  const id = getYouTubeVideoId(value);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : '';
}

const YOUTUBE_EMBED_CSS = `
.pagero-youtube-embed{width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:18px;background:#0f172a}
.pagero-youtube-embed iframe{width:100%;height:100%;display:block;border:0}
.pagero-youtube-empty{width:100%;min-height:148px;display:grid;place-items:center;padding:22px;border:1px dashed #cbd5e1;border-radius:18px;background:#f8fafc;color:#64748b;font:700 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}
`;

export function createYouTubeCodeSettings(value = '') {
  const raw = String(value || '').trim();
  const embedUrl = getYouTubeEmbedUrl(raw);
  const emptyMessage = raw ? '올바른 YouTube 링크를 입력하세요' : 'YouTube 링크를 입력하세요';
  const html = embedUrl
    ? `<div class="pagero-youtube-embed"><iframe src="${embedUrl}" title="YouTube video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe></div>`
    : `<div class="pagero-youtube-empty">${emptyMessage}</div>`;

  return {
    widgetMode: 'youtube',
    youtubeUrl: raw,
    html,
    css: YOUTUBE_EMBED_CSS,
    js: '',
    runJs: false,
    height: 'auto',
  };
}

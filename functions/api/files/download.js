import {
  FILE_METHODS,
  fileBucket,
  handleApiError,
  jsonResponse,
  optionsResponse,
  safeFileName,
  validateObjectKey,
} from './_files.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, FILE_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, FILE_METHODS);
  }

  try {
    const url = new URL(request.url);
    const key = validateObjectKey(url.searchParams.get('key') || '');
    const bucket = fileBucket(env);
    const object = await bucket.get(key);
    if (!object) {
      return jsonResponse(request, env, 404, { ok: false, error: '파일을 찾을 수 없습니다.', message: '파일을 찾을 수 없습니다.' }, FILE_METHODS, {
        cacheControl: 'no-store',
      });
    }

    const fileName = safeFileName(object.customMetadata?.originalName || key.split('/').pop() || 'download');
    const asciiName = fileName.replace(/[^\x20-\x7E]+/g, '_').replace(/"/g, "'");
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    const inlineMedia = /^video\//i.test(contentType) || String(object.customMetadata?.purpose || '') === 'media';
    const disposition = inlineMedia
      ? `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': String(object.size || ''),
        'Cache-Control': inlineMedia ? 'public, max-age=31536000, immutable' : 'public, max-age=86400, s-maxage=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return handleApiError(request, env, error, FILE_METHODS);
  }
}

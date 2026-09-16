import {
  authorizeProject,
  fileBucket,
  handleApiError,
  jsonResponse,
  listProjectAssetObjects,
  normalizeAssetKind,
  optionsResponse,
  projectFromRequest,
  publicDownloadUrl,
} from './_files.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
      message: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  try {
    const url = new URL(request.url);
    const project = projectFromRequest(url, {}, request);
    await authorizeProject(request, env, project, { tab: 'edit' });

    const kind = normalizeAssetKind(url.searchParams.get('kind') || 'image');
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)));
    const cursor = String(url.searchParams.get('cursor') || '').trim();
    const bucket = fileBucket(env);
    const result = await listProjectAssetObjects(bucket, project, kind, { limit, cursor });

    return jsonResponse(request, env, 200, {
      ok: true,
      kind,
      assets: result.assets.map((asset) => ({
        ...asset,
        downloadUrl: publicDownloadUrl(request, asset.key),
      })),
      hasMore: result.hasMore,
      cursor: result.cursor,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

import {
  FILE_METHODS,
  assertAllowedFile,
  authorizeProject,
  fileBucket,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
  publicDownloadUrl,
  safeObjectKey,
} from './_files.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, FILE_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, FILE_METHODS);
  }

  try {
    const url = new URL(request.url);
    const form = await request.formData();
    const file = form.get('file');
    const projectRaw = String(form.get('project') || '{}');
    let body = {};
    try {
      body = { project: JSON.parse(projectRaw) };
    } catch {
      body = {};
    }
    const project = projectFromRequest(url, body, request);
    await authorizeProject(request, env, project, { write: true, tab: 'edit' });

    if (!file || typeof file.stream !== 'function') {
      return jsonResponse(request, env, 400, { ok: false, error: '업로드할 파일이 없습니다.', message: '업로드할 파일이 없습니다.' }, FILE_METHODS);
    }

    const bucket = fileBucket(env);
    const meta = assertAllowedFile(file);
    const key = safeObjectKey(project, meta.extension);

    await bucket.put(key, file.stream(), {
      httpMetadata: {
        contentType: meta.contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        originalName: meta.name,
        extension: meta.extension,
        projectId: project.projectId || project.id || '',
        uploadedAt: new Date().toISOString(),
      },
    });

    return jsonResponse(request, env, 200, {
      ok: true,
      key,
      fileName: meta.name,
      extension: meta.extension,
      size: file.size || 0,
      downloadUrl: publicDownloadUrl(request, key),
    }, FILE_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, FILE_METHODS);
  }
}

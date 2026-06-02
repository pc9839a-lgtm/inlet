import { ApiError, apiFetch, projectAuthHeaders } from './apiClient.js';
import { projectContext } from './projectContext.js';

export async function uploadDownloadFile(file, page = {}, authUser = null) {
  if (!file) throw new ApiError('업로드할 파일이 없습니다.', 400);
  const project = projectContext(page, authUser);
  const form = new FormData();
  form.append('file', file);
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

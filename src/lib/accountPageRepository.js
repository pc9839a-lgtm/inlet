import { apiFetch } from './apiClient.js';

function text(value = '') {
  return String(value || '').trim();
}

export async function fetchSelectedAccountPage(page = {}, authUser = null) {
  const pageId = text(page.id || page.pageId);
  const projectId = text(page.projectId);
  const slug = text(page.slug);
  const session = text(authUser?.session);
  if (!pageId || !projectId || !slug || !session) return null;

  const params = new URLSearchParams({ pageId, projectId, slug });
  const res = await apiFetch(`/api/account-page?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store',
      Pragma: 'no-cache',
      'X-Inlet-Session': session,
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(raw || `선택한 페이지 불러오기 실패: ${res.status}`);
  }

  const data = await res.json();
  return data?.page || null;
}

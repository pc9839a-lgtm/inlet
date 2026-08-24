import { leadError, text } from './_utils.js';

const DEFAULT_GRAPH_VERSION = 'v24.0';

export async function verifyMetaPageAccess(env = {}, pageId = '', pageAccessToken = '') {
  const safePageId = String(pageId || '').trim();
  const token = String(pageAccessToken || '').trim();
  if (!/^[0-9]{3,40}$/.test(safePageId) || token.length < 20) {
    throw leadError('Meta Page credentials are invalid.', 400, 'CALLTAG_META_PAGE_CREDENTIAL_INVALID');
  }

  const url = new URL(`https://graph.facebook.com/${metaGraphVersion(env)}/${encodeURIComponent(safePageId)}`);
  url.searchParams.set('fields', 'id,name');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error || String(body?.id || '') !== safePageId) {
    throw leadError('Meta Page access could not be verified.', 400, 'CALLTAG_META_PAGE_ACCESS_DENIED');
  }
  return {
    pageId: safePageId,
    pageName: text(body?.name, 160),
  };
}

export function metaGraphVersion(env = {}) {
  const value = String(env.CALLTAG_META_GRAPH_VERSION || '').trim();
  return /^v\d{1,3}\.\d{1,2}$/.test(value) ? value : DEFAULT_GRAPH_VERSION;
}

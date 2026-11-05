// The current draft is sent once across two same-origin tabs in memory.
// The URL contains a random handshake token, never page content or leads.
export const DRAFT_PREVIEW_PARAM = '__pagero_preview';
const CHANNEL_PREFIX = 'pagero-editor-draft-preview:';

export function validDraftPreviewToken(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function draftPreviewChannelName(token) {
  if (!validDraftPreviewToken(token)) throw new Error('Invalid preview token');
  return CHANNEL_PREFIX + token;
}

export function draftPreviewTabUrl(token, origin) {
  const url = new URL('/', origin);
  url.searchParams.set(DRAFT_PREVIEW_PARAM, token);
  return url.toString();
}

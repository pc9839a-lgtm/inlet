import { syncError } from './_shared.js';

const encoder = new TextEncoder();

export async function securePayloadHash(
  env,
  ownerId,
  entityType,
  entityId,
  version,
  payload,
) {
  const secret = decodeKeyMaterial(env.CALLTAG_DATA_SEARCH_KEY);
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const material = JSON.stringify({
    ownerId: String(ownerId || ''),
    entityType: String(entityType || ''),
    entityId: String(entityId || ''),
    version: Number(version || 0),
    payload: payload && typeof payload === 'object' ? payload : {},
  });
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(material));
  return Array.from(
    new Uint8Array(signature),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
}

function decodeKeyMaterial(value) {
  const text = String(value || '').trim();
  let bytes = new Uint8Array();
  if (/^[a-fA-F0-9]{64}$/.test(text)) {
    bytes = new Uint8Array(text.match(/.{2}/g).map((part) => parseInt(part, 16)));
  } else {
    try {
      const binary = atob(text);
      bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    } catch {
      bytes = new Uint8Array();
    }
  }
  if (bytes.length !== 32) {
    throw syncError('CALLTAG_DATA_SEARCH_KEY 설정이 올바르지 않습니다.', 503, 'CALLTAG_SYNC_KEY_INVALID');
  }
  return bytes;
}

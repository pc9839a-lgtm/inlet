import { leadError, text } from './_utils.js';

const ENVELOPE_VERSION = 1;
const ALGORITHM = 'A256GCM';

export async function encryptProviderCredential(env = {}, plaintext = '', aad = '') {
  const value = String(plaintext || '').trim();
  if (!value) throw leadError('Provider credential is required.', 400, 'CALLTAG_PROVIDER_CREDENTIAL_REQUIRED');
  const key = await credentialKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(text(aad, 500));
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
    key,
    new TextEncoder().encode(value),
  ));
  return JSON.stringify({
    v: ENVELOPE_VERSION,
    alg: ALGORITHM,
    iv: base64Url(iv),
    ct: base64Url(cipher),
  });
}

export async function decryptProviderCredential(env = {}, envelopeJson = '', aad = '') {
  let envelope = null;
  try { envelope = JSON.parse(String(envelopeJson || '')); }
  catch { throw leadError('Provider credential envelope is invalid.', 500, 'CALLTAG_PROVIDER_CREDENTIAL_INVALID'); }
  if (Number(envelope?.v) !== ENVELOPE_VERSION || envelope?.alg !== ALGORITHM || !envelope?.iv || !envelope?.ct) {
    throw leadError('Provider credential envelope is unsupported.', 500, 'CALLTAG_PROVIDER_CREDENTIAL_UNSUPPORTED');
  }
  const key = await credentialKey(env);
  const iv = fromBase64Url(envelope.iv);
  const cipher = fromBase64Url(envelope.ct);
  const additionalData = new TextEncoder().encode(text(aad, 500));
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
      key,
      cipher,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw leadError('Provider credential could not be decrypted.', 503, 'CALLTAG_PROVIDER_CREDENTIAL_DECRYPT_FAILED');
  }
}

export async function hmacSha256Hex(secret = '', bodyBytes = new Uint8Array()) {
  const value = String(secret || '');
  if (!value) throw leadError('Provider signing secret is not configured.', 503, 'CALLTAG_PROVIDER_SIGNING_SECRET_REQUIRED');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, bodyBytes));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualText(left = '', right = '') {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

async function credentialKey(env = {}) {
  const secret = String(env.CALLTAG_PROVIDER_CREDENTIAL_KEY || '').trim();
  if (secret.length < 32) {
    throw leadError('Provider credential encryption is not configured.', 503, 'CALLTAG_PROVIDER_CREDENTIAL_KEY_REQUIRED');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value = '') {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

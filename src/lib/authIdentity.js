import { WORKSPACE_KEY } from '../config/storageKeys.js';

function safeId(value, fallback = '') {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9-_]/g, '');
  return cleaned || fallback;
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`.slice(0, 24);
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function readOrCreateWorkspaceId() {
  if (typeof localStorage === 'undefined') return 'local-user';
  try {
    const current = safeId(localStorage.getItem(WORKSPACE_KEY), '');
    if (current) return current;
    const next = `ws_${randomId()}`;
    localStorage.setItem(WORKSPACE_KEY, next);
    return next;
  } catch {
    return 'local-user';
  }
}

export function workspaceIdForAuthUser(user = null) {
  const current = safeId(user?.workspaceId, '');
  if (current) return current;
  const identity = String(user?.email || user?.id || user?.name || '').trim().toLowerCase();
  if (identity) return `user_${stableHash(identity)}`;
  return readOrCreateWorkspaceId();
}

export function normalizeAuthUser(user = null) {
  if (!user || typeof user !== 'object') return null;
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.name || '').trim() || '사용자';
  const phone = String(user.phone || '').replace(/\D/g, '');
  const workspaceId = workspaceIdForAuthUser({ ...user, email, name });
  return {
    ...user,
    id: safeId(user.id, workspaceId),
    name,
    email,
    phone,
    workspaceId,
    signedAt: user.signedAt || new Date().toISOString(),
  };
}

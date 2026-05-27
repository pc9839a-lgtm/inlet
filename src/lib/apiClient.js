import { runtimeApiUrl, runtimeConfig } from '../config/runtimeConfig.js';

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function apiHeaders(headers = {}) {
  const next = { ...(headers || {}) };
  if (runtimeApiToken() && !next.Authorization && !next.authorization) {
    next.Authorization = `Bearer ${runtimeApiToken()}`;
  }
  if (runtimeApiToken() && !next['X-Inlet-Api-Token'] && !next['x-inlet-api-token']) {
    next['X-Inlet-Api-Token'] = runtimeApiToken();
  }
  return next;
}

export function projectAuthHeaders(context = {}, headers = {}) {
  const next = { ...(headers || {}) };
  if (context?.ownerId && !next['X-Inlet-Owner-Id'] && !next['x-inlet-owner-id']) {
    next['X-Inlet-Owner-Id'] = context.ownerId;
  }
  if (context?.projectId && !next['X-Inlet-Project-Id'] && !next['x-inlet-project-id']) {
    next['X-Inlet-Project-Id'] = context.projectId;
  }
  if (context?.session && !next['X-Inlet-Session'] && !next['x-inlet-session']) {
    next['X-Inlet-Session'] = context.session;
  }
  return next;
}

export function apiFetch(path, options = {}) {
  return fetch(runtimeApiUrl(path), {
    ...options,
    headers: apiHeaders(options.headers || {}),
  });
}

function runtimeApiToken() {
  return String(runtimeConfig.apiToken || '').trim();
}

async function readApiError(res) {
  const raw = await res.text().catch(() => '');
  if (!raw) return { message: `요청 실패: ${res.status}`, details: null };

  try {
    const json = JSON.parse(raw);
    return { message: json?.message || json?.error?.message || json?.error || raw, details: json };
  } catch {
    return { message: raw, details: null };
  }
}

export async function postJson(path, payload, options = {}) {
  const res = await apiFetch(path, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(payload || {}),
    keepalive: !!options.keepalive,
  });

  if (!res.ok) {
    const error = await readApiError(res);
    throw new ApiError(error.message, res.status, error.details);
  }

  const text = await res.text().catch(() => '');
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { ok: true, text };
  }
}

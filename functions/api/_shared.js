import { getD1ProjectAccess } from '../../server/storage/d1Adapter.mjs';

const DEFAULT_ORIGIN = 'https://pagero.kr';
const MANAGER_TABS = ['edit', 'style', 'inbox', 'stats', 'settings'];
const CLIENT_ADMIN_TABS = ['inbox', 'stats', 'settings'];

export function corsHeaders(request, env = {}, methods = 'GET, POST, OPTIONS') {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.INLET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || DEFAULT_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Inlet-Api-Token, X-Inlet-Owner-Id, X-Inlet-Project-Id, X-Inlet-Session',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function jsonResponse(request, env, status, payload, methods, options = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': options.cacheControl || 'no-store',
      ...corsHeaders(request, env, methods),
      ...(options.headers || {}),
    },
  });
}

export function optionsResponse(request, env, methods) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env, methods) });
}

export async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Invalid JSON body.');
    error.status = 400;
    throw error;
  }
}

export function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthFromRequest(url, body = {}) {
  return String(url.searchParams.get('month') || body.month || body.lead?.createdMonth || body.event?.createdMonth || currentMonth()).slice(0, 7);
}

export function projectFromRequest(url, body = {}, request = null) {
  const project = body.project && typeof body.project === 'object' ? body.project : {};
  const headerProjectId = request?.headers?.get('X-Inlet-Project-Id') || '';
  const projectId = String(project.projectId || project.id || url.searchParams.get('projectId') || headerProjectId || '').trim();
  const ownerId = String(project.ownerId || project.ownerAccountId || url.searchParams.get('ownerId') || '').trim();
  const slug = String(project.slug || url.searchParams.get('slug') || '').trim();
  return {
    ...project,
    projectId,
    id: project.id || projectId,
    ownerId,
    slug,
  };
}

export function assertD1(env = {}) {
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    const error = new Error('D1 binding is not configured.');
    error.status = 503;
    throw error;
  }
  return env.DB;
}

export async function ensureD1ProjectShell(db, project = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  if (!projectId) return null;
  const ownerId = String(project.ownerId || project.ownerAccountId || `public_${projectId}`).trim();
  const safeOwnerId = ownerId || `public_${projectId}`;
  const slug = String(project.slug || projectId).replace(/[^a-zA-Z0-9-_]/g, '') || projectId;
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT OR IGNORE INTO accounts (
      id, email, phone, name, password_hash, email_verified_at, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    safeOwnerId,
    `${safeOwnerId}@public.inlet.local`,
    null,
    safeOwnerId,
    '',
    now,
    'active',
    now,
    now,
  ).run();

  await db.prepare(`
    INSERT OR IGNORE INTO projects (
      id, owner_account_id, slug, title, client_email, plan, billing_status, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    projectId,
    safeOwnerId,
    slug,
    String(project.title || slug),
    String(project.clientEmail || '').trim().toLowerCase(),
    String(project.plan || 'free'),
    String(project.billingStatus || 'trial'),
    String(project.status || 'active'),
    now,
    now,
  ).run();

  return { projectId, ownerId: safeOwnerId, slug };
}

export function publicProjectShell(project = {}) {
  return {
    ...project,
    ownerId: '',
    ownerAccountId: '',
  };
}

export function apiTokenAuthorized(request, env = {}) {
  const expected = String(env.INLET_API_TOKEN || '').trim();
  if (!expected) return false;
  const headerToken = String(request.headers.get('X-Inlet-Api-Token') || '').trim();
  const auth = String(request.headers.get('Authorization') || '').trim();
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return headerToken === expected || bearer === expected;
}

export async function sessionIdentity(request, env = {}) {
  const token = String(request.headers.get('X-Inlet-Session') || '').trim();
  const secret = String(env.INLET_SESSION_SECRET || '').trim();
  if (!token || !secret) return null;
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;
  const expected = await hmacBase64Url(payloadPart, secret);
  if (signaturePart !== expected) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadPart));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return {
      ownerId: String(payload.ownerId || ''),
      projectId: String(payload.projectId || ''),
      role: String(payload.role || ''),
      email: String(payload.email || ''),
      source: 'signed-session',
    };
  } catch {
    return null;
  }
}

export async function authorizeProject(request, env = {}, project = {}, options = {}) {
  if (!project.projectId) {
    const error = new Error('projectId is required.');
    error.status = 400;
    throw error;
  }
  if (options.publicWrite === true && request.method === 'POST') return { project, identity: null };
  if (apiTokenAuthorized(request, env)) return { project, identity: { source: 'api-token' } };

  const enforce = String(env.INLET_PROJECT_AUTH_ENFORCE || '1') !== '0';
  const identity = await sessionIdentity(request, env);
  if (!enforce) return { project, identity };
  const role = normalizeRole(identity?.role);

  if (identity && env.DB && typeof env.DB.prepare === 'function') {
    const access = await getD1ProjectAccess(env.DB, { projectId: project.projectId });
    if (access) {
      if (canUseProjectAccess(identity, access, options)) return { project, identity, access };
      const error = new Error(options.write ? 'Project write access denied.' : 'Project access denied.');
      error.status = 403;
      throw error;
    }
  }

  if (identity && ['master', 'owner', 'builder'].includes(role) && sameOwnerIdentity(identity, project)) {
    return { project, identity };
  }

  if (identity && (!identity.projectId || identity.projectId === project.projectId)) {
    if (apiTokenAuthorized(request, env)) return { project, identity };
    if (['master', 'owner', 'builder'].includes(role)) return { project, identity };
    if (!options.write && ['manager', 'client_admin'].includes(role)) return { project, identity };
  }

  const error = new Error('Project access is required.');
  error.status = 403;
  throw error;
}

function normalizeRole(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[-\s]/g, '_');
}

function normalizeAccess(access = {}) {
  return MANAGER_TABS.reduce((next, tab) => {
    const current = access?.[tab] || {};
    next[tab] = {
      read: !!current.read || !!current.write,
      write: !!current.write,
    };
    return next;
  }, {});
}

function isMasterLikeIdentity(identity = {}) {
  return ['master', 'owner', 'builder'].includes(normalizeRole(identity.role));
}

function isPublicProjectShell(access = {}) {
  return String(access.ownerId || '').startsWith('public_');
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function identityOwnerAliases(identity = {}) {
  const aliases = new Set();
  const ownerId = String(identity.ownerId || '').trim();
  const email = String(identity.email || '').trim().toLowerCase();
  if (ownerId) aliases.add(ownerId);
  if (email) aliases.add(`user_${stableHash(email)}`);
  return aliases;
}

function sameOwnerIdentity(identity = {}, project = {}) {
  const projectOwnerId = String(project.ownerId || project.ownerAccountId || '').trim();
  if (!projectOwnerId) return true;
  return identityOwnerAliases(identity).has(projectOwnerId);
}

function activeMemberFor(identity = {}, access = {}) {
  const ownerIds = identityOwnerAliases(identity);
  const managers = Array.isArray(access.managers) ? access.managers : [];
  if (ownerIds.has(String(access.ownerId || ''))) {
    return { role: 'master', access: {}, status: 'active' };
  }
  if (ownerIds.size && isPublicProjectShell(access) && isMasterLikeIdentity(identity)) {
    return { role: 'master', access: {}, status: 'active', pendingClaim: true };
  }
  if (Array.isArray(access.clientOwnerIds) && access.clientOwnerIds.some((id) => ownerIds.has(String(id || '')))) {
    return { role: 'client_admin', access: {}, status: 'active' };
  }
  return managers.find((member) => member.status === 'active' && ownerIds.has(String(member.ownerId || ''))) || null;
}

function canUseProjectAccess(identity = {}, access = {}, options = {}) {
  const member = activeMemberFor(identity, access);
  if (!member) return false;
  const role = normalizeRole(member.role || identity.role);
  if (role === 'master') return true;
  if (options.masterOnly) return false;

  const tab = String(options.tab || '').trim();
  if (role === 'client_admin') {
    if (!tab) return !options.write;
    return CLIENT_ADMIN_TABS.includes(tab);
  }
  if (role !== 'manager') return false;
  if (!tab) return !options.write;
  const permission = normalizeAccess(member.access || {})[tab] || {};
  return options.write ? !!permission.write : (!!permission.read || !!permission.write);
}

export async function handleApiError(request, env, error, methods) {
  const status = Number(error?.status || 500);
  return jsonResponse(request, env, status, {
    ok: false,
    error: String(error?.message || error),
  }, methods);
}

async function hmacBase64Url(payloadPart, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadPart));
  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value = '') {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

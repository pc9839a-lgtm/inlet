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
    const error = new Error('요청 데이터 형식이 올바르지 않습니다.');
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
    const error = new Error('서버 데이터베이스 연결이 준비되지 않았습니다.');
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
  const secret = sessionSecret(env);
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

function sessionSecret(env = {}) {
  return String(env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-auth-secret').trim();
}

export async function authorizeProject(request, env = {}, project = {}, options = {}) {
  if (!project.projectId) {
    const error = new Error('프로젝트 정보가 누락되었습니다.');
    error.status = 400;
    throw error;
  }
  if (apiTokenAuthorized(request, env)) return { project, identity: { source: 'api-token' } };

  const enforce = String(env.INLET_PROJECT_AUTH_ENFORCE || '1') !== '0';
  const identity = await sessionIdentity(request, env);
  if (options.publicWrite === true && request.method === 'POST' && !identity) return { project, identity: null };
  if (!enforce) return { project, identity };
  const role = normalizeRole(identity?.role);

  if (identity && env.DB && typeof env.DB.prepare === 'function') {
    const access = await getD1ProjectAccess(env.DB, { projectId: project.projectId });
    if (access) {
      const member = activeMemberFor(identity, access);
      if (canUseProjectAccess(identity, access, options, member)) {
        if (member?.pendingClaim && options.write) {
          await claimD1ProjectShell(env.DB, project, identity, access);
          return { project, identity, access: { ...access, ownerId: identity.ownerId } };
        }
        return { project, identity, access };
      }
      const error = new Error(options.write
        ? '현재 계정에 이 페이지 저장 권한이 없습니다. 마스터 계정 또는 편집 권한을 확인해주세요.'
        : '현재 계정에 이 페이지 접근 권한이 없습니다. 다시 로그인하거나 페이지 소유 계정을 확인해주세요.');
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

  const error = new Error('현재 계정에 이 페이지 접근 권한이 없습니다. 다시 로그인하거나 페이지 소유 계정을 확인해주세요.');
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

function isClaimableProjectShell(access = {}) {
  const ownerId = String(access.ownerId || '').trim();
  return !ownerId || ownerId === 'local-user' || ownerId.startsWith('public_') || ownerId.startsWith('ws_');
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
  if (ownerIds.size && isClaimableProjectShell(access) && isMasterLikeIdentity(identity)) {
    return { role: 'master', access: {}, status: 'active', pendingClaim: true };
  }
  if (Array.isArray(access.clientOwnerIds) && access.clientOwnerIds.some((id) => ownerIds.has(String(id || '')))) {
    return { role: 'client_admin', access: {}, status: 'active' };
  }
  return managers.find((member) => member.status === 'active' && ownerIds.has(String(member.ownerId || ''))) || null;
}

function canUseProjectAccess(identity = {}, access = {}, options = {}, activeMember = null) {
  const member = activeMember || activeMemberFor(identity, access);
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

async function claimD1ProjectShell(db, project = {}, identity = {}, access = {}) {
  const projectId = String(access.projectId || project.projectId || '').trim();
  const ownerId = String(identity.ownerId || '').trim();
  const previousOwnerId = String(access.ownerId || '').trim();
  if (!db?.prepare || !projectId || !ownerId || !isClaimableProjectShell(access)) return false;
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE projects
    SET owner_account_id = ?, updated_at = ?
    WHERE id = ? AND owner_account_id = ?
  `).bind(ownerId, now, projectId, previousOwnerId).run();
  await db.prepare(`
    INSERT INTO project_members (
      id, project_id, account_id, role, access_json, status, invited_by_account_id, created_at, updated_at
    )
    VALUES (?, ?, ?, 'master', '{}', 'active', NULL, ?, ?)
    ON CONFLICT(project_id, account_id) DO UPDATE SET
      role = 'master',
      access_json = '{}',
      status = 'active',
      updated_at = excluded.updated_at
  `).bind(`${projectId}-master-${ownerId}`, projectId, ownerId, now, now).run();
  return true;
}

export async function handleApiError(request, env, error, methods) {
  const status = Number(error?.status || 500);
  const message = cleanUserFacingApiError(error?.message || error, status);
  return jsonResponse(request, env, status, {
    ok: false,
    error: message,
    message,
    code: error?.code || error?.details?.code || '',
  }, methods);
}

function cleanUserFacingApiError(message = '', status = 0) {
  const text = String(message || '').trim();
  if (/AUTH_EMAIL_DUPLICATE|Email is already registered/i.test(text)) return '이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.';
  if (/AUTH_PHONE_DUPLICATE|Phone number is already registered/i.test(text)) return '이미 가입된 휴대폰번호입니다. 계정 정보를 확인해주세요.';
  if (/AUTH_PASSWORD_POLICY|Password must include letters and numbers/i.test(text)) return '비밀번호는 영문과 숫자를 포함해 6자리 이상으로 입력해주세요.';
  if (/EMAIL_VERIFICATION_REQUIRED|Email verification is required/i.test(text)) return '이메일 인증을 먼저 완료해주세요.';
  if (/EMAIL_VERIFICATION_INVALID|Email verification token is invalid/i.test(text)) return '인증 코드가 올바르지 않습니다. 다시 확인해주세요.';
  if (/EMAIL_VERIFICATION_EXPIRED|Email verification token has expired/i.test(text)) return '인증 코드가 만료되었습니다. 인증 메일을 다시 받아주세요.';
  if (/AUTH_LOGIN_INVALID|Email or password is invalid/i.test(text)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
  if (/AUTH_LOGIN_REQUIRED|Email and password are required/i.test(text)) return '이메일과 비밀번호를 입력해주세요.';
  if (/AUTH_EMAIL_REQUIRED|Valid email is required/i.test(text)) return '올바른 이메일을 입력해주세요.';
  if (/AUTH_PHONE_REQUIRED|Phone number is required/i.test(text)) return '휴대폰번호를 입력해주세요.';
  if (/AUTH_ACCOUNT_NOT_FOUND|Account was not found/i.test(text)) return '계정을 찾을 수 없습니다.';
  if (/AUTH_ACCOUNT_SUSPENDED|Account is suspended/i.test(text)) return '정지된 계정입니다. 고객센터에 문의해주세요.';
  if (/AUTH_ACCOUNT_DELETED|Account is deleted/i.test(text)) return '삭제 대기 중인 계정입니다. 고객센터에 문의해주세요.';
  if (/Page URL is already in use|PAGE_SLUG_CONFLICT|UNIQUE constraint failed: pages\.project_id, pages\.slug/i.test(text)) return '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.';
  if (/UNIQUE constraint failed: pages\.id/i.test(text)) return '페이지 저장 중 주소 충돌이 발생했습니다. 새로고침 후 다시 저장해주세요.';
  if (/Project write access denied/i.test(text)) return '현재 계정에 이 페이지 저장 권한이 없습니다. 마스터 계정 또는 편집 권한을 확인해주세요.';
  if (/Project access is required|Project access has not been granted|Project access denied/i.test(text)) return '현재 계정에 이 페이지 접근 권한이 없습니다. 다시 로그인하거나 페이지 소유 계정을 확인해주세요.';
  if (/projectId is required/i.test(text)) return '프로젝트 정보가 누락되었습니다.';
  if (/D1 binding is not configured/i.test(text)) return '서버 데이터베이스 연결이 준비되지 않았습니다.';
  if (/Invalid JSON body/i.test(text)) return '요청 데이터 형식이 올바르지 않습니다.';
  return text || `요청 처리 실패: ${status}`;
}

function userFacingApiError(message = '', status = 0) {
  const text = String(message || '').trim();
  if (/Page URL is already in use|PAGE_SLUG_CONFLICT|UNIQUE constraint failed: pages\.project_id, pages\.slug/i.test(text)) return '이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.';
  if (/UNIQUE constraint failed: pages\.id/i.test(text)) return '페이지 저장 중 주소 충돌이 발생했습니다. 새로고침 후 다시 저장해주세요.';
  if (/Project write access denied/i.test(text)) return '현재 계정에 이 페이지 저장 권한이 없습니다. 마스터 계정 또는 편집 권한을 확인해주세요.';
  if (/Project access is required|Project access has not been granted|Project access denied/i.test(text)) return '현재 계정에 이 페이지 접근 권한이 없습니다. 다시 로그인하거나 페이지 소유 계정을 확인해주세요.';
  if (/projectId is required/i.test(text)) return '프로젝트 정보가 누락되었습니다.';
  if (/D1 binding is not configured/i.test(text)) return '서버 데이터베이스 연결이 준비되지 않았습니다.';
  if (/Invalid JSON body/i.test(text)) return '요청 데이터 형식이 올바르지 않습니다.';
  return text || `요청 처리 실패: ${status}`;
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

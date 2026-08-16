import { callError } from '../_shared.js';
import {
  getCalltagAdminEntitlement,
  grantCalltagAdminEntitlement,
  normalizeAdminEntitlementScope,
  revokeCalltagAdminEntitlement,
} from '../../billing/_adminEntitlements.js';
import {
  adminErrorResponse,
  adminJson,
  ownerIdInput,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (!['GET', 'POST'].includes(request.method)) {
    return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    if (!env.DB?.prepare) {
      return adminJson(503, { ok: false, error: '관리자 저장소가 연결되지 않았습니다.', code: 'CALLTAG_ADMIN_DB_REQUIRED' });
    }
    const identity = await requireCalltagAdmin(request, env);
    const input = request.method === 'GET'
      ? Object.fromEntries(new URL(request.url).searchParams.entries())
      : await readBody(request);
    const ownerId = ownerIdInput(input.ownerId || '');
    const profile = await env.DB.prepare(`
      SELECT owner_id
      FROM calllink_profiles
      WHERE owner_id = ?
      LIMIT 1
    `).bind(ownerId).first();
    if (!profile?.owner_id) {
      throw callError('회원을 찾을 수 없습니다.', 404, { code: 'CALLTAG_ADMIN_MEMBER_NOT_FOUND' });
    }

    if (request.method === 'GET') {
      const entitlement = await getCalltagAdminEntitlement(env.DB, ownerId);
      await recordAdminAudit(env.DB, request, env, identity, 'member.entitlement.read', ownerId);
      return adminJson(200, { ok: true, ownerId, entitlement });
    }

    const action = String(input.action || 'grant').trim().toLowerCase();
    if (action === 'grant') {
      const scope = normalizeAdminEntitlementScope(input.scope || 'all');
      const durationDays = Math.trunc(Number(input.durationDays || 0));
      if (!scope || !Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3660) {
        throw callError('이용권 범위 또는 기간이 올바르지 않습니다.', 400, { code: 'CALLTAG_ADMIN_ENTITLEMENT_INVALID' });
      }
      const entitlement = await grantCalltagAdminEntitlement(env.DB, {
        ownerId,
        scope,
        durationDays,
        note: String(input.note || '').slice(0, 300),
        grantedBy: identity.ownerId,
      });
      await recordAdminAudit(env.DB, request, env, identity, 'member.entitlement.grant', ownerId);
      return adminJson(200, { ok: true, ownerId, entitlement });
    }

    if (action === 'revoke') {
      const entitlement = await revokeCalltagAdminEntitlement(env.DB, {
        ownerId,
        revokedBy: identity.ownerId,
      });
      await recordAdminAudit(env.DB, request, env, identity, 'member.entitlement.revoke', ownerId);
      return adminJson(200, { ok: true, ownerId, entitlement });
    }

    throw callError('지원하지 않는 이용권 작업입니다.', 400, { code: 'CALLTAG_ADMIN_ENTITLEMENT_ACTION_INVALID' });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function readBody(request) {
  const text = await request.text().catch(() => '');
  if (!text || text.length > 4096) {
    throw callError('요청 데이터가 올바르지 않습니다.', 400, { code: 'CALLTAG_ADMIN_BODY_INVALID' });
  }
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    return body;
  } catch {
    throw callError('요청 데이터가 올바르지 않습니다.', 400, { code: 'CALLTAG_ADMIN_BODY_INVALID' });
  }
}

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: METHODS,
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

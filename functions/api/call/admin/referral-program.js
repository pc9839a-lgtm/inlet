import {
  adminErrorResponse,
  adminJson,
  recordAdminAudit,
  requireCalltagAdmin,
} from './_security.js';
import {
  readJsonBody,
  requireCalltagFinanceAdmin,
} from './_financeSecurity.js';
import {
  readCallTagReferralProgramConfig,
  updateCallTagReferralProgramConfig,
} from '../../referrals/_calltag-program.js';

const METHODS = 'GET, POST, OPTIONS';

function options() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: METHODS,
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return options();

  try {
    if (request.method === 'GET') {
      await requireCalltagAdmin(request, env);
      const config = await readCallTagReferralProgramConfig(env.DB);
      return adminJson(200, { ok: true, config });
    }

    if (request.method === 'POST') {
      const identity = await requireCalltagFinanceAdmin(
        request,
        env,
        'referral.program.update',
      );
      const body = await readJsonBody(request, 8192);
      const config = await updateCallTagReferralProgramConfig(
        env.DB,
        body,
        identity.ownerId,
      );
      await recordAdminAudit(
        env.DB,
        request,
        env,
        identity,
        'referral.program.update',
        '',
      );
      return adminJson(200, { ok: true, config });
    }

    return adminJson(405, {
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Method not allowed.',
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

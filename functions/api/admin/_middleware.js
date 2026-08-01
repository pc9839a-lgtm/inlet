import { handleApiError } from '../_shared.js';
import { requirePlatformMaster } from './_auth.js';

const ADMIN_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

function validDomainRecheckSecret(request, env = {}) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/api/admin/domains/recheck') return false;
  const expected = String(env.INLET_DOMAIN_RECHECK_SECRET || '').trim();
  if (!expected) return false;
  const header = String(request.headers.get('X-Inlet-Domain-Recheck-Secret') || '').trim();
  const bearer = String(request.headers.get('Authorization') || '').trim();
  return header === expected || bearer === `Bearer ${expected}`;
}

export async function onRequest({ request, env, next }) {
  if (request.method === 'OPTIONS') return next();
  if (validDomainRecheckSecret(request, env)) return next();

  try {
    await requirePlatformMaster(request, env);
    return next();
  } catch (error) {
    return handleApiError(request, env, error, ADMIN_METHODS);
  }
}

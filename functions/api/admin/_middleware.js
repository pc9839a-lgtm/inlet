import { handleApiError } from '../_shared.js';
import { requirePlatformMaster } from './_auth.js';

const ADMIN_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

function exactSecret(request, env = {}, config = {}) {
  const pathname = new URL(request.url).pathname;
  if (pathname !== config.pathname) return false;
  const expected = String(env[config.envKey] || '').trim();
  if (!expected) return false;
  const header = String(request.headers.get(config.header) || '').trim();
  const bearer = String(request.headers.get('Authorization') || '').trim();
  return header === expected || bearer === `Bearer ${expected}`;
}

function validOperationalSecret(request, env = {}) {
  return exactSecret(request, env, {
    pathname: '/api/admin/domains/recheck',
    envKey: 'INLET_DOMAIN_RECHECK_SECRET',
    header: 'X-Inlet-Domain-Recheck-Secret',
  }) || exactSecret(request, env, {
    pathname: '/api/admin/audit/retention',
    envKey: 'INLET_AUDIT_RETENTION_SECRET',
    header: 'X-Inlet-Audit-Retention-Secret',
  });
}

export async function onRequest({ request, env, next }) {
  if (request.method === 'OPTIONS') return next();
  if (validOperationalSecret(request, env)) return next();

  try {
    await requirePlatformMaster(request, env);
    return next();
  } catch (error) {
    return handleApiError(request, env, error, ADMIN_METHODS);
  }
}

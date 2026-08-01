import { sessionIdentity } from '../_shared.js';
import { isPlatformMasterIdentity } from '../_platformMaster.js';

export async function requirePlatformMaster(request, env = {}) {
  const identity = await sessionIdentity(request, env);
  if (identity?.ownerId && isPlatformMasterIdentity(identity, env)) return identity;

  const error = new Error('전체 관리자 권한이 필요합니다.');
  error.status = identity ? 403 : 401;
  error.details = { code: 'PLATFORM_MASTER_REQUIRED' };
  throw error;
}

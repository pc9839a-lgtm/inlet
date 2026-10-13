import { getSessionAccount } from '../auth/_auth.js';
import { isPlatformMasterIdentity } from '../_platformMaster.js';

// A signed token alone is not enough for platform-wide administrator access.
// Look up the current D1 account and verify its active/verified status, bound
// account ID and session version before evaluating the administrator allowlist.
export async function requirePlatformMaster(request, env = {}) {
  const { payload, user } = await getSessionAccount(request, env);
  const identity = {
    ownerId: String(user.ownerId || user.id || ''),
    projectId: String(payload.projectId || ''),
    role: String(payload.role || ''),
    email: String(user.email || ''),
    source: 'signed-session',
  };
  if (identity.ownerId && isPlatformMasterIdentity(identity, env)) return identity;

  const error = new Error('전체 관리자 권한이 필요합니다.');
  error.status = 403;
  error.details = { code: 'PLATFORM_MASTER_REQUIRED' };
  throw error;
}

import { readFile } from 'node:fs/promises';
import { authorizeProject } from '../functions/api/_shared.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function request(headers = {}) {
  return new Request('https://pagero.kr/api/projects/invites', { headers });
}

{
  const req = request({ 'X-Inlet-Api-Token': 'qa-internal-token' });
  const env = { INLET_API_TOKEN: 'qa-internal-token' };
  const project = { projectId: 'project-qa' };

  const legacy = await authorizeProject(req, env, project, {});
  assert(legacy.identity?.source === 'api-token', 'ordinary internal project routes must keep existing API-token compatibility');

  let sensitiveError = null;
  try {
    await authorizeProject(req, env, project, { requireSignedSession: true });
  } catch (error) {
    sensitiveError = error;
  }
  assert(sensitiveError?.status === 401, 'sensitive project routes must reject API-token-only authorization');
  assert(sensitiveError?.details?.code === 'AUTH_SIGNED_SESSION_REQUIRED', 'sensitive project routes must expose AUTH_SIGNED_SESSION_REQUIRED');
}

const shared = await readFile('functions/api/_shared.js', 'utf8');
const invitesRoute = await readFile('functions/api/projects/invites.js', 'utf8');
const inviteHelper = await readFile('functions/api/projects/_invites.js', 'utf8');
const ownershipRoute = await readFile('functions/api/projects/ownership-transfer.js', 'utf8');
const ownershipHelper = await readFile('functions/api/projects/_ownership.js', 'utf8');
const adminOwnership = await readFile('functions/api/admin/ownership-transfer/[id].js', 'utf8');
const d1 = await readFile('server/storage/d1Adapter.mjs', 'utf8');

assert(shared.includes('options.requireSignedSession === true'), 'authorizeProject must support signed-session-only authorization');
assert(shared.includes("code: 'AUTH_SIGNED_SESSION_REQUIRED'"), 'authorizeProject must fail with an explicit signed-session error');
assert(invitesRoute.includes('requireSignedSession: true'), 'manager invite creation must require a signed user session');
assert(ownershipRoute.includes('requireSignedSession: true'), 'ownership-transfer access must require a signed user session');

assert(inviteHelper.includes("const ownerId = String(identity.ownerId || '').trim();"), 'manager invites must derive the actor owner only from the signed identity');
assert(inviteHelper.includes('getD1ProjectById(db, projectId)'), 'manager invites must load the persisted project before mutating invite state');
assert(inviteHelper.includes("code: 'PROJECT_OWNER_REQUIRED'"), 'manager invites must reject non-owner signed sessions');
assert(!inviteHelper.includes('identity.ownerId || project.ownerId'), 'manager invites must never fall back to a request-supplied owner id');
assert(!inviteHelper.includes('upsertD1Project(db,'), 'manager invite creation must never rewrite project ownership');
assert(!inviteHelper.includes('ensureD1ProjectShell(db,'), 'manager invite creation must not create arbitrary project shells');

assert(ownershipHelper.includes("const actorOwnerId = String(identity.ownerId || '').trim();"), 'ownership transfer must require an explicit signed actor owner id');
assert(ownershipHelper.includes("code: 'PROJECT_OWNER_REQUIRED'"), 'ownership transfer must bind requests to the actual owner');
assert(!ownershipHelper.includes('clientOwnerIds?.includes(identity.ownerId)'), 'client admin must not be treated as the project owner for ownership transfer');

assert(adminOwnership.includes("import { requirePlatformMaster } from '../_auth.js';"), 'admin ownership updates must use platform-master authorization');
assert(adminOwnership.includes('const identity = await requirePlatformMaster(request, env);'), 'admin ownership updates must re-check platform-master identity in-route');
assert(!adminOwnership.includes('authorizeProject(request, env, project'), 'admin ownership updates must not rely on generic project API-token authorization');

assert(d1.includes("const ownerId = project.ownerId || '';"), 'D1 project access must use projects.owner_account_id as the ownership source');
assert(!d1.includes("masters[0]?.ownerId || project.ownerId"), 'project_members master rows must never override persisted project ownership');

console.log(JSON.stringify({
  ok: true,
  scope: 'sensitive-project-authorization',
  apiTokenCompatibilityPreserved: true,
  signedSessionRequiredForInvites: true,
  signedSessionRequiredForOwnershipTransfer: true,
  inviteOwnershipMutationBlocked: true,
  persistedProjectOwnerIsSourceOfTruth: true,
  adminOwnershipUsesPlatformMaster: true,
}, null, 2));

import { normalizeAuthUser, workspaceIdForAuthUser } from '../src/lib/authIdentity.js';
import { ACCESS_MODES, accessModeFor, canReadTab, canUseAdminSurface, canUseBuilderSurface, canWriteTab, tabsForAccessMode } from '../src/lib/authContext.js';
import { projectContext } from '../src/lib/projectContext.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const userA1 = normalizeAuthUser({ name: 'User A', email: 'Owner@Example.COM' });
const userA2 = normalizeAuthUser({ name: 'Another Name', email: 'owner@example.com' });
const userB = normalizeAuthUser({ name: 'User B', email: 'other@example.com' });

assert(userA1.email === 'owner@example.com', 'email should normalize to lowercase');
assert(userA1.workspaceId === userA2.workspaceId, 'same email should keep same workspace id');
assert(userA1.workspaceId !== userB.workspaceId, 'different email should have different workspace id');
assert(workspaceIdForAuthUser({ workspaceId: 'custom_ws' }) === 'custom_ws', 'explicit workspace id should win');

const page = { slug: 'campaign' };
const contextA = projectContext(page, userA1);
const contextA2 = projectContext(page, userA2);
const contextB = projectContext(page, userB);

assert(contextA.projectId === contextA2.projectId, 'same user should map to same project');
assert(contextA.projectId !== contextB.projectId, 'different users should map to different projects');
assert(contextA.slug === 'campaign', 'slug should be preserved');
assert(contextA.legacyProjectId.includes('ownerexamplecom'), 'legacy project fallback should remain available');

const clientUser = normalizeAuthUser({ name: 'Client', email: 'client@example.com' });
const ownerPage = {
  slug: 'campaign',
  ownership: {
    ownerEmail: 'owner@example.com',
    clientEmail: 'client@example.com',
    clientAccess: true,
    managers: [
      {
        id: 'manager-1',
        name: 'Editor Manager',
        email: 'manager@example.com',
        status: 'active',
        access: {
          edit: { read: true, write: true },
          style: { read: true, write: false },
          inbox: { read: true, write: false },
          stats: { read: true, write: false },
          settings: { read: false, write: false },
        },
      },
    ],
  },
};
const managerUser = normalizeAuthUser({ name: 'Manager', email: 'manager@example.com' });
const builderMode = accessModeFor({ authUser: userA1, page: ownerPage });
const managerMode = accessModeFor({ authUser: managerUser, page: ownerPage });
const clientModeDisabled = accessModeFor({ authUser: clientUser, page: ownerPage });
const clientMode = accessModeFor({ authUser: clientUser, page: ownerPage, clientAdminEnabled: true });
const roleClientMode = accessModeFor({ authUser: { ...userB, role: 'client-admin' }, page, clientAdminEnabled: true });
const unauthorizedMode = accessModeFor({ authUser: null, page });

assert(builderMode === ACCESS_MODES.BUILDER, 'owner should stay in builder mode');
assert(managerMode === ACCESS_MODES.MANAGER, 'invited manager should enter manager mode');
assert(clientModeDisabled === ACCESS_MODES.BUILDER, 'client admin mode should stay disabled without the internal flag');
assert(clientMode === ACCESS_MODES.CLIENT_ADMIN, 'matching client email should enter client admin mode');
assert(roleClientMode === ACCESS_MODES.CLIENT_ADMIN, 'explicit client-admin role should enter client admin mode');
assert(unauthorizedMode === ACCESS_MODES.UNAUTHORIZED, 'missing auth should be unauthorized');
assert(tabsForAccessMode(clientMode).join(',') === 'inbox,stats,settings', 'client admin tabs should be limited');
assert(tabsForAccessMode(builderMode).includes('edit') && tabsForAccessMode(builderMode).includes('style'), 'builder tabs should include editor surfaces');
assert(tabsForAccessMode(managerMode, ownerPage, managerUser).join(',') === 'edit,style,inbox,stats', 'manager tabs should follow read/write permissions');
assert(canReadTab(managerMode, ownerPage, managerUser, 'edit'), 'manager should read allowed edit tab');
assert(canWriteTab(managerMode, ownerPage, managerUser, 'edit'), 'manager should write allowed edit tab');
assert(!canWriteTab(managerMode, ownerPage, managerUser, 'style'), 'manager style write should be separately denied');
assert(!canReadTab(managerMode, ownerPage, managerUser, 'settings'), 'manager should not read denied settings tab');
assert(!canUseBuilderSurface(clientMode), 'client admin must not use builder surfaces');
assert(canUseBuilderSurface(builderMode), 'builder mode must use builder surfaces');
assert(canUseBuilderSurface(managerMode, ownerPage, managerUser), 'manager with edit/style access should use builder surfaces');
assert(canUseAdminSurface(builderMode), 'builder should use admin surface');
assert(!canUseAdminSurface(managerMode), 'manager must not use admin surface');

console.log(JSON.stringify({ ok: true, checks: 27 }, null, 2));

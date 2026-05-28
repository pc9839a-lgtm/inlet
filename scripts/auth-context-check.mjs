import { normalizeAuthUser, workspaceIdForAuthUser } from '../src/lib/authIdentity.js';
import { ACCESS_MODES, accessModeFor, canReadTab, canUseAdminSurface, canUseBuilderSurface, canWriteTab, managerForAuthUser, tabsForAccessMode } from '../src/lib/authContext.js';
import { authAccountErrorMessage, isValidAccountPassword, normalizeAccountPhone } from '../src/lib/authAccounts.js';
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
      {
        id: 'manager-disabled',
        name: 'Disabled Manager',
        email: 'disabled-manager@example.com',
        status: 'disabled',
        access: {
          edit: { read: true, write: true },
          style: { read: true, write: true },
          inbox: { read: true, write: true },
          stats: { read: true, write: false },
          settings: { read: true, write: false },
        },
      },
      {
        id: 'manager-removed',
        name: 'Removed Manager',
        email: 'removed-manager@example.com',
        status: 'removed',
        access: {
          edit: { read: true, write: true },
          style: { read: true, write: true },
          inbox: { read: true, write: true },
          stats: { read: true, write: false },
          settings: { read: true, write: false },
        },
      },
    ],
  },
};
const managerUser = normalizeAuthUser({ name: 'Manager', email: 'manager@example.com' });
const disabledManagerUser = normalizeAuthUser({ name: 'Disabled Manager', email: 'disabled-manager@example.com' });
const removedManagerUser = normalizeAuthUser({ name: 'Removed Manager', email: 'removed-manager@example.com' });
const builderMode = accessModeFor({ authUser: userA1, page: ownerPage });
const managerMode = accessModeFor({ authUser: managerUser, page: ownerPage });
const disabledManagerMode = accessModeFor({ authUser: disabledManagerUser, page: ownerPage });
const removedManagerMode = accessModeFor({ authUser: removedManagerUser, page: ownerPage });
const clientModeDisabled = accessModeFor({ authUser: clientUser, page: ownerPage });
const clientMode = accessModeFor({ authUser: clientUser, page: ownerPage, clientAdminEnabled: true });
const roleClientMode = accessModeFor({ authUser: { ...userB, role: 'client-admin' }, page, clientAdminEnabled: true });
const unauthorizedMode = accessModeFor({ authUser: null, page });

assert(builderMode === ACCESS_MODES.BUILDER, 'owner should stay in builder mode');
assert(managerMode === ACCESS_MODES.MANAGER, 'invited manager should enter manager mode');
assert(disabledManagerMode === ACCESS_MODES.UNAUTHORIZED, 'disabled manager should be unauthorized');
assert(removedManagerMode === ACCESS_MODES.UNAUTHORIZED, 'removed manager should be unauthorized');
assert(managerForAuthUser(ownerPage, disabledManagerUser) === null, 'disabled manager lookup should return null');
assert(managerForAuthUser(ownerPage, removedManagerUser) === null, 'removed manager lookup should return null');
assert(clientModeDisabled === ACCESS_MODES.UNAUTHORIZED, 'client admin mode should stay unauthorized without the internal flag');
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

assert(normalizeAccountPhone('+82 10-1234-5678') === '01012345678', 'account phone should normalize Korean country code');
assert(normalizeAccountPhone('010-1234-5678') === '01012345678', 'account phone should keep local mobile number digits');
assert(isValidAccountPassword('abc123'), 'account password should allow 6+ chars with letters and numbers');
assert(!isValidAccountPassword('abcdef'), 'account password should require a number');
assert(!isValidAccountPassword('123456'), 'account password should require an English letter');
assert(!isValidAccountPassword('a1'), 'account password should require at least 6 chars');

const authErrorMessages = [
  ['AUTH_EMAIL_DUPLICATE', '이미 가입된 이메일입니다. 로그인해주세요.'],
  ['AUTH_PHONE_DUPLICATE', '이미 가입된 휴대폰 번호입니다. 다른 번호를 확인해주세요.'],
  ['AUTH_PASSWORD_POLICY', '비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.'],
  ['EMAIL_VERIFICATION_REQUIRED', '이메일 인증을 먼저 완료해주세요.'],
  ['AUTH_LOGIN_INVALID', '이메일 또는 비밀번호가 올바르지 않습니다.'],
  ['AUTH_SESSION_INVALID', '로그인 세션이 만료되었습니다. 다시 로그인해주세요.'],
];

for (const [code, expected] of authErrorMessages) {
  const message = authAccountErrorMessage({ details: { code } });
  assert(message === expected, `${code} message should stay user-facing Korean`);
  assert(!/[?�]/.test(message), `${code} message should not contain mojibake or replacement characters`);
}

console.log(JSON.stringify({ ok: true, checks: 43 }, null, 2));

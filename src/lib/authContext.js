export const ACCESS_MODES = {
  BUILDER: 'builder',
  MANAGER: 'manager',
  CLIENT_ADMIN: 'clientAdmin',
  VIEWER: 'viewer',
  UNAUTHORIZED: 'unauthorized',
};

export const CLIENT_ADMIN_TABS = ['inbox', 'stats', 'settings'];
export const BUILDER_TABS = ['edit', 'style', 'inbox', 'stats', 'settings'];
export const MANAGER_PERMISSION_TABS = ['edit', 'style', 'inbox', 'stats', 'settings'];

export const DEFAULT_MANAGER_ACCESS = {
  edit: { read: true, write: false },
  style: { read: false, write: false },
  inbox: { read: true, write: false },
  stats: { read: true, write: false },
  settings: { read: false, write: false },
};

function normalizedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizedMode(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[-_\s]/g, '');
}

function safeAccess(access = {}) {
  return MANAGER_PERMISSION_TABS.reduce((next, tab) => {
    const current = access?.[tab] || {};
    next[tab] = {
      read: !!current.read || !!current.write,
      write: !!current.write,
    };
    return next;
  }, {});
}

export function normalizeManagerAccount(manager = {}) {
  const email = normalizedEmail(manager.email);
  const status = ['active', 'disabled', 'removed'].includes(manager.status) ? manager.status : 'active';
  return {
    id: String(manager.id || email || `manager-${Date.now()}`),
    name: String(manager.name || '').trim(),
    email,
    status,
    invitedAt: manager.invitedAt || '',
    inviteToken: String(manager.inviteToken || '').trim(),
    inviteUrl: String(manager.inviteUrl || '').trim(),
    inviteStatus: manager.inviteStatus || '',
    acceptedAt: manager.acceptedAt || '',
    expiresAt: manager.expiresAt || '',
    access: safeAccess(manager.access || DEFAULT_MANAGER_ACCESS),
  };
}

function safeOwnership(page = {}) {
  const ownership = page?.ownership && typeof page.ownership === 'object' ? page.ownership : {};
  return {
    ownerEmail: normalizedEmail(ownership.ownerEmail || page.ownerEmail),
    clientEmail: normalizedEmail(ownership.clientEmail || page.clientEmail),
    clientAccess: ownership.clientAccess !== false,
    transferredAt: ownership.transferredAt || '',
    managers: Array.isArray(ownership.managers) ? ownership.managers.map(normalizeManagerAccount) : [],
  };
}

export function managerForAuthUser(page = {}, authUser = null) {
  const email = normalizedEmail(authUser?.email);
  if (!email) return null;
  const ownership = safeOwnership(page);
  return ownership.managers.find((manager) => manager.status === 'active' && manager.email === email) || null;
}

export function accessModeFor({ authUser = null, page = null, clientAdminEnabled = false } = {}) {
  if (!authUser) return ACCESS_MODES.UNAUTHORIZED;
  if (!page || typeof page !== 'object') return ACCESS_MODES.UNAUTHORIZED;

  const userMode = normalizedMode(authUser.accessMode || authUser.mode || authUser.role);
  if (clientAdminEnabled && ['clientadmin', 'client', 'adminclient'].includes(userMode)) return ACCESS_MODES.CLIENT_ADMIN;
  if (['viewer', 'readonly', 'viewonly'].includes(userMode)) return ACCESS_MODES.VIEWER;
  if (['manager', 'member', 'staff'].includes(userMode) && managerForAuthUser(page, authUser)) return ACCESS_MODES.MANAGER;
  if (['builder', 'operator', 'owner', 'master'].includes(userMode)) return ACCESS_MODES.BUILDER;

  const ownership = safeOwnership(page);
  const email = normalizedEmail(authUser.email);
  if (ownership.ownerEmail && ownership.ownerEmail === email) return ACCESS_MODES.BUILDER;
  if (managerForAuthUser(page, authUser)) return ACCESS_MODES.MANAGER;
  if (clientAdminEnabled && ownership.clientAccess && ownership.clientEmail && ownership.clientEmail === email) {
    return ACCESS_MODES.CLIENT_ADMIN;
  }
  if (ownership.ownerEmail) return ACCESS_MODES.UNAUTHORIZED;

  return ACCESS_MODES.BUILDER;
}

export function isClientAdminMode(mode) {
  return mode === ACCESS_MODES.CLIENT_ADMIN;
}

export function isManagerMode(mode) {
  return mode === ACCESS_MODES.MANAGER;
}

export function isBuilderMode(mode) {
  return mode === ACCESS_MODES.BUILDER;
}

export function tabsForAccessMode(mode, page = null, authUser = null) {
  if (mode === ACCESS_MODES.CLIENT_ADMIN) return CLIENT_ADMIN_TABS;
  if (mode === ACCESS_MODES.BUILDER) return BUILDER_TABS;
  if (mode === ACCESS_MODES.MANAGER) {
    const manager = managerForAuthUser(page, authUser);
    return MANAGER_PERMISSION_TABS.filter((tab) => !!manager?.access?.[tab]?.read || !!manager?.access?.[tab]?.write);
  }
  return [];
}

export function canUseBuilderSurface(mode, page = null, authUser = null) {
  if (mode === ACCESS_MODES.BUILDER) return true;
  if (mode !== ACCESS_MODES.MANAGER) return false;
  const tabs = tabsForAccessMode(mode, page, authUser);
  return tabs.includes('edit') || tabs.includes('style');
}

export function canUseAdminSurface(mode) {
  return mode === ACCESS_MODES.BUILDER;
}

export function canReadTab(mode, page, authUser, tab) {
  return tabsForAccessMode(mode, page, authUser).includes(tab);
}

export function canWriteTab(mode, page, authUser, tab) {
  if (mode === ACCESS_MODES.BUILDER) return true;
  if (mode === ACCESS_MODES.CLIENT_ADMIN) return CLIENT_ADMIN_TABS.includes(tab);
  if (mode !== ACCESS_MODES.MANAGER) return false;
  const manager = managerForAuthUser(page, authUser);
  return !!manager?.access?.[tab]?.write;
}

export function normalizeOwnershipSettings(page = {}, authUser = null) {
  const current = safeOwnership(page);
  return {
    ownerEmail: current.ownerEmail || normalizedEmail(authUser?.email),
    clientEmail: current.clientEmail,
    clientAccess: current.clientAccess,
    transferredAt: current.transferredAt,
    managers: current.managers,
  };
}

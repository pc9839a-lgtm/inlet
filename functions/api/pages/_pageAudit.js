import { auditSubjectHash, writeAuditLog } from '../_audit.js';

function normalizedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizedStatus(value = '') {
  return String(value || 'active').trim().toLowerCase() || 'active';
}

function managerList(page = {}) {
  return Array.isArray(page?.ownership?.managers)
    ? page.ownership.managers.filter((manager) => manager && typeof manager === 'object')
    : [];
}

function managerKey(manager = {}) {
  const email = normalizedEmail(manager.email || manager.managerEmail || '');
  if (email) return `email:${email}`;
  const id = String(manager.ownerId || manager.accountId || manager.id || '').trim();
  return id ? `id:${id}` : '';
}

function normalizedAccess(access = {}) {
  return Object.fromEntries(
    Object.keys(access || {})
      .sort()
      .map((tab) => {
        const permission = access?.[tab] || {};
        return [tab, {
          read: !!permission.read || !!permission.write,
          write: !!permission.write,
        }];
      }),
  );
}

function changedAccessTabs(previous = {}, next = {}) {
  const previousAccess = normalizedAccess(previous);
  const nextAccess = normalizedAccess(next);
  const tabs = [...new Set([...Object.keys(previousAccess), ...Object.keys(nextAccess)])].sort();
  return tabs.filter((tab) => JSON.stringify(previousAccess[tab] || {}) !== JSON.stringify(nextAccess[tab] || {}));
}

async function managerTargetId(manager = {}, env = {}) {
  const explicit = String(manager.ownerId || manager.accountId || manager.id || '').trim();
  if (explicit) return explicit;
  return auditSubjectHash(manager.email || manager.managerEmail || '', env).catch(() => '');
}

async function writeManagerAudit({ request, env, identity, projectId, action, manager, metadata }) {
  await writeAuditLog({
    request,
    env,
    identity,
    projectId,
    action,
    targetType: 'project_member',
    targetId: await managerTargetId(manager, env),
    metadata,
  });
}

export async function writePageManagerAuditChanges({
  request,
  env = {},
  identity = null,
  projectId = '',
  previousPage = null,
  nextPage = null,
} = {}) {
  const previousManagers = managerList(previousPage);
  const nextManagers = managerList(nextPage);
  const previousByKey = new Map(previousManagers.map((manager) => [managerKey(manager), manager]).filter(([key]) => key));
  const nextByKey = new Map(nextManagers.map((manager) => [managerKey(manager), manager]).filter(([key]) => key));

  for (const [key, previous] of previousByKey) {
    const next = nextByKey.get(key);
    if (!next) {
      await writeManagerAudit({
        request,
        env,
        identity,
        projectId,
        action: 'manager.removed',
        manager: previous,
        metadata: {
          previousStatus: normalizedStatus(previous.status),
          previousAccess: normalizedAccess(previous.access || {}),
        },
      });
      continue;
    }

    const previousStatus = normalizedStatus(previous.status);
    const nextStatus = normalizedStatus(next.status);
    if (previousStatus !== nextStatus) {
      await writeManagerAudit({
        request,
        env,
        identity,
        projectId,
        action: 'manager.status_changed',
        manager: next,
        metadata: { previousStatus, nextStatus },
      });
    }

    const changedTabs = changedAccessTabs(previous.access || {}, next.access || {});
    if (changedTabs.length) {
      await writeManagerAudit({
        request,
        env,
        identity,
        projectId,
        action: 'manager.permissions_changed',
        manager: next,
        metadata: {
          changedTabs,
          previousAccess: normalizedAccess(previous.access || {}),
          nextAccess: normalizedAccess(next.access || {}),
        },
      });
    }
  }

  for (const [key, next] of nextByKey) {
    if (previousByKey.has(key)) continue;
    await writeManagerAudit({
      request,
      env,
      identity,
      projectId,
      action: 'manager.member_added',
      manager: next,
      metadata: {
        status: normalizedStatus(next.status),
        access: normalizedAccess(next.access || {}),
      },
    });
  }
}

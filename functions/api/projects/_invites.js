import { getD1InviteByToken, upsertD1Invite, upsertD1Project, upsertD1ProjectMember } from '../../../server/storage/d1Adapter.mjs';
import { writeAuditLog } from '../_audit.js';
import { ensureD1ProjectShell } from '../_shared.js';
import { createSessionToken, loginAccount, normalizeEmail, normalizePhone, ownerIdForEmail, registerAccount } from '../auth/_auth.js';

export const INVITE_METHODS = 'GET, POST, OPTIONS';
export const MANAGER_TABS = ['edit', 'style', 'inbox', 'stats', 'settings'];

export function normalizeManagerAccess(access = {}) {
  return MANAGER_TABS.reduce((next, tab) => {
    const current = access?.[tab] || {};
    next[tab] = {
      read: !!current.read || !!current.write,
      write: !!current.write,
    };
    return next;
  }, {});
}

export function publicInvite(invite = {}) {
  return {
    id: invite.id || '',
    name: invite.name || '',
    email: invite.email || '',
    status: invite.status || 'pending',
    access: normalizeManagerAccess(invite.access || {}),
    invitedAt: invite.invitedAt || invite.createdAt || '',
    acceptedAt: invite.acceptedAt || '',
    expiresAt: invite.expiresAt || '',
    project: invite.project || (invite.projectId ? { projectId: invite.projectId } : null),
  };
}

export function inviteError(message, status = 400, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

export async function createD1ManagerInvite(db, project = {}, manager = {}, identity = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  if (!projectId) throw inviteError('projectId is required.', 400, { code: 'PROJECT_ID_REQUIRED' });
  const ownerId = String(identity.ownerId || project.ownerId || '').trim();
  if (!ownerId) throw inviteError('Project owner identity is required.', 403, { code: 'PROJECT_ACCESS_REQUIRED' });
  await ensureD1ProjectShell(db, { ...project, ownerId });
  await upsertD1Project(db, {
    ...project,
    projectId,
    ownerId,
    ownerAccountId: ownerId,
    slug: project.slug || projectId,
    updatedAt: new Date().toISOString(),
  }, {
    projectId,
    ownerId,
    slug: project.slug || projectId,
  });
  await upsertD1ProjectMember(db, {
    id: `${projectId}-${ownerId}-master`,
    ownerId,
    role: 'master',
    access: {},
    status: 'active',
  }, {
    projectId,
    accountId: ownerId,
    invitedByAccountId: ownerId,
  });

  const email = normalizeEmail(manager.email || manager.managerEmail || '');
  if (!email) throw inviteError('Manager email is required.', 400, { code: 'MANAGER_EMAIL_REQUIRED' });
  const token = crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  const invite = await upsertD1Invite(db, {
    id: String(manager.id || `invite-${projectId}-${ownerIdForEmail(email)}`),
    projectId,
    name: String(manager.name || manager.managerName || email).trim(),
    email,
    ownerId: ownerIdForEmail(email),
    token,
    tokenHash: token,
    access: normalizeManagerAccess(manager.access || {}),
    status: 'pending',
    invitedAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  }, {
    projectId,
    ownerId,
    invitedByAccountId: ownerId,
  });
  return {
    ...publicInvite({ ...invite, project: { ...project, projectId } }),
    token,
    acceptUrl: `/invite/${encodeURIComponent(token)}`,
  };
}

export async function getD1PublicInvite(db, token = '') {
  const invite = await getD1InviteByToken(db, token);
  if (!invite) throw inviteError('Invite not found.', 404, { code: 'INVITE_NOT_FOUND' });
  return publicInvite({ ...invite, project: { projectId: invite.projectId } });
}

export async function acceptD1ManagerInvite(request, env = {}, token = '', input = {}) {
  const invite = await getD1InviteByToken(env.DB, token);
  if (!invite) throw inviteError('Invite not found.', 404, { code: 'INVITE_NOT_FOUND' });
  if (invite.status !== 'pending') throw inviteError('Invite is not pending.', 409, { code: 'INVITE_NOT_PENDING' });
  if (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) {
    await upsertD1Invite(env.DB, { ...invite, status: 'expired' }, { projectId: invite.projectId, invitedByAccountId: invite.invitedByAccountId });
    throw inviteError('Invite has expired.', 410, { code: 'INVITE_EXPIRED' });
  }

  const email = normalizeEmail(input.email || invite.email || '');
  if (email !== normalizeEmail(invite.email || '')) throw inviteError('Invite email does not match.', 403, { code: 'INVITE_EMAIL_MISMATCH' });
  const authMode = String(input.authMode || '').toLowerCase();
  const authResult = authMode === 'signup'
    ? {
      user: await registerAccount({
        name: input.name || invite.name || email,
        email,
        phone: normalizePhone(input.phone || ''),
        password: input.password || '',
        token: input.token || input.verificationToken || '',
        source: 'manager-invite',
      }, env),
    }
    : await loginAccount({ email, password: input.password || '', projectId: invite.projectId, role: 'manager' }, env);

  const ownerId = authResult.user?.ownerId || ownerIdForEmail(email);
  const acceptedAt = new Date().toISOString();
  const acceptedInvite = await upsertD1Invite(env.DB, {
    ...invite,
    status: 'accepted',
    acceptedAccountId: ownerId,
    acceptedAt,
  }, {
    projectId: invite.projectId,
    invitedByAccountId: invite.invitedByAccountId,
  });
  const manager = await upsertD1ProjectMember(env.DB, {
    id: invite.id || ownerId,
    ownerId,
    accountId: ownerId,
    role: 'manager',
    access: normalizeManagerAccess(invite.access || {}),
    status: 'active',
    acceptedAt,
    invitedByAccountId: invite.invitedByAccountId || null,
  }, {
    projectId: invite.projectId,
    accountId: ownerId,
    invitedByAccountId: invite.invitedByAccountId || null,
  });

  await writeAuditLog({
    request,
    env,
    actorAccountId: ownerId,
    projectId: invite.projectId || '',
    action: 'manager.invite_accepted',
    targetType: 'project_member',
    targetId: manager.id || ownerId,
    metadata: {
      inviteId: invite.id || '',
      authMode: authMode === 'signup' ? 'signup' : 'login',
      status: 'active',
      access: normalizeManagerAccess(invite.access || {}),
    },
  });

  return {
    invite: publicInvite({ ...acceptedInvite, project: { projectId: invite.projectId } }),
    manager: {
      id: manager.id || ownerId,
      ownerId,
      name: input.name || invite.name || email,
      email,
      status: 'active',
      access: normalizeManagerAccess(invite.access || {}),
      acceptedAt,
    },
    project: { projectId: invite.projectId },
    session: await createSessionToken({ ownerId, projectId: invite.projectId, role: 'manager', email }, env),
  };
}

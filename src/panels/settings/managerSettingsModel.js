import { MANAGER_PERMISSION_TABS } from '../../lib/authContext.js';

export const MANAGER_TAB_LABELS = {
  edit: '\uD3B8\uC9D1',
  style: '\uC2A4\uD0C0\uC77C',
  inbox: '\uC811\uC218\uD568',
  stats: '\uD1B5\uACC4',
  settings: '\uC124\uC815',
};

export const MANAGER_ACCESS_PRESETS = [
  {
    id: 'editor',
    label: '\uD3B8\uC9D1 \uB2F4\uB2F9',
    access: {
      edit: { read: true, write: true },
      style: { read: true, write: true },
      inbox: { read: false, write: false },
      stats: { read: false, write: false },
      settings: { read: false, write: false },
    },
  },
  {
    id: 'lead',
    label: '\uC811\uC218 \uB2F4\uB2F9',
    access: {
      edit: { read: false, write: false },
      style: { read: false, write: false },
      inbox: { read: true, write: true },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  },
  {
    id: 'viewer',
    label: '\uC870\uD68C \uC804\uC6A9',
    access: {
      edit: { read: false, write: false },
      style: { read: false, write: false },
      inbox: { read: true, write: false },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  },
];

export function managerLabel(manager) {
  return manager.name || manager.email || '\uC0C8 \uB9E4\uB2C8\uC800';
}

export function managerAccessSummary(manager) {
  const access = manager.access || {};
  const editable = MANAGER_PERMISSION_TABS.filter((tab) => access[tab]?.write).map((tab) => MANAGER_TAB_LABELS[tab]);
  const viewOnly = MANAGER_PERMISSION_TABS.filter((tab) => access[tab]?.read && !access[tab]?.write).map((tab) => MANAGER_TAB_LABELS[tab]);
  if (manager.status !== 'active') return '\uBE44\uD65C\uC131';
  if (editable.length) return '\uD3B8\uC9D1 ' + editable.join(', ');
  if (viewOnly.length) return '\uBCF4\uAE30 ' + viewOnly.join(', ');
  return '\uAD8C\uD55C \uC5C6\uC74C';
}

export function managerInviteState(manager, inviteUrl = '') {
  if (manager.acceptedAt) return '\uAC00\uC785 \uC644\uB8CC';
  if (inviteUrl) return '\uCD08\uB300 \uB9C1\uD06C \uC788\uC74C';
  return '\uCD08\uB300 \uC804';
}

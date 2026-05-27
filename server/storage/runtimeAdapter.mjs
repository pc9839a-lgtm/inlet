import { assertD1Binding, d1UnavailablePlan } from './d1Adapter.mjs';

const STORAGE_MODES = new Set(['jsonl', 'd1', 'auto']);

export const D1_RUNTIME_ROUTE_COVERAGE = [
  {
    key: 'accounts',
    label: 'Account auth/session/profile/password/status',
    routes: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/session',
      'PATCH /api/auth/account',
      'PATCH /api/auth/account/status',
      'POST /api/auth/password',
    ],
    d1: 'active',
  },
  {
    key: 'pages',
    label: 'Page read/write/revisions',
    routes: [
      'GET /api/page/:slug',
      'POST /api/page/:slug',
      'GET /api/page/:slug/revisions',
      'GET /api/page/:slug/revisions/:id',
    ],
    d1: 'active',
  },
  {
    key: 'leads',
    label: 'Inbox leads and CSV',
    routes: [
      'GET /api/leads',
      'POST /api/leads',
      'PATCH /api/leads/:id',
      'DELETE /api/leads/:id',
      'GET /api/leads/export.csv',
    ],
    d1: 'active',
  },
  {
    key: 'eventsStats',
    label: 'Events and stats summary',
    routes: [
      'GET /api/events',
      'POST /api/events',
      'GET /api/stats/summary',
    ],
    d1: 'active',
  },
  {
    key: 'delivery',
    label: 'Delivery logs and retry queue',
    routes: [
      'GET /api/leads/delivery-logs',
      'GET /api/leads/retry-queue',
    ],
    d1: 'active',
  },
  {
    key: 'aiDrafts',
    label: 'AI draft history',
    routes: [
      'GET /api/ai/drafts',
      'POST /api/ai/drafts',
      'DELETE /api/ai/drafts/:id',
    ],
    d1: 'active',
  },
  {
    key: 'invitesMembers',
    label: 'Manager invites and member access',
    routes: [
      'POST /api/projects/invites',
      'GET /api/projects/invites/:token',
      'POST /api/projects/invites/:token/accept',
    ],
    d1: 'partial',
    note: 'Project access writes are mirrored into D1 when active; access.json remains the local compatibility source for legacy projects.',
  },
  {
    key: 'ownershipTransfer',
    label: 'Ownership transfer requests',
    routes: [
      'GET /api/projects/ownership-transfer',
      'POST /api/projects/ownership-transfer',
      'PATCH /api/admin/ownership-transfer/:id',
    ],
    d1: 'active',
  },
  {
    key: 'aiKeys',
    label: 'Customer AI key storage',
    routes: [
      'GET /api/ai/key',
      'PUT /api/ai/key',
      'DELETE /api/ai/key',
    ],
    d1: 'active',
    note: 'Hosted Pages Functions store encrypted customer AI keys in D1; local server keeps JSONL fallback for development.',
  },
];

export function normalizeStorageMode(value = 'jsonl') {
  const mode = String(value || '').trim().toLowerCase();
  return STORAGE_MODES.has(mode) ? mode : 'jsonl';
}

export function detectD1Binding(env = {}) {
  return env.DB || env.INLET_D1 || env.d1 || null;
}

export function createStorageRuntime(env = {}) {
  const requested = normalizeStorageMode(env.INLET_STORAGE_ADAPTER || env.INLET_STORAGE_MODE || 'jsonl');
  const d1 = detectD1Binding(env);
  const d1Ready = (() => {
    try {
      assertD1Binding(d1);
      return true;
    } catch {
      return false;
    }
  })();
  const active = (requested === 'd1' || requested === 'auto') && d1Ready ? 'd1' : 'jsonl';
  return {
    requested,
    active,
    d1,
    d1Ready,
    fallback: requested === 'd1' && active !== 'd1',
    jsonlFallback: active === 'jsonl',
  };
}

export function storageRuntimeHealth(runtime = {}) {
  return {
    requested: runtime.requested || 'jsonl',
    active: runtime.active || 'jsonl',
    d1Ready: !!runtime.d1Ready,
    fallback: !!runtime.fallback,
  };
}

export function storageRuntimeCoverage(runtime = {}) {
  const active = runtime.active || 'jsonl';
  const requested = runtime.requested || 'jsonl';
  return D1_RUNTIME_ROUTE_COVERAGE.map((item) => {
    const desired = item.d1;
    const status = active === 'd1' ? desired : 'jsonl';
    const fallback = requested === 'd1' && active !== 'd1';
    return {
      key: item.key,
      label: item.label,
      status,
      adapter: status === 'active' || status === 'partial' ? 'd1' : 'jsonl',
      d1Ready: active === 'd1',
      fallback,
      routes: [...item.routes],
      ...(item.note ? { note: item.note } : {}),
    };
  });
}

export function storageRuntimePlan(runtime = {}, type = 'records', filters = {}, extra = {}) {
  if (runtime.active === 'd1') {
    return {
      adapter: 'd1',
      indexed: true,
      fullScan: false,
      available: true,
      type,
      filters: { ...filters },
      activeIndexFields: Array.isArray(extra.activeIndexFields) ? extra.activeIndexFields : [],
      missingIndexFields: [],
      migrationPriority: extra.migrationPriority || 'runtime-d1',
      ...extra,
    };
  }
  if (runtime.requested === 'd1' && !runtime.d1Ready) {
    return d1UnavailablePlan(type, filters, {
      ...extra,
      migrationPriority: extra.migrationPriority || 'missing-runtime-binding',
    });
  }
  return null;
}

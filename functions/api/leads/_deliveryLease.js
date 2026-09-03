export const DELIVERY_LEASE_STATUS = 'sending';
export const DELIVERY_LEASE_STALE_MS = 15 * 60 * 1000;

const RETRYABLE_DELIVERY_STATUSES = new Set(['pending', 'none', 'failed', 'partial']);

function deliveryStatus(lead = {}) {
  return String(lead.delivery?.status || lead.deliveryStatus || 'pending').trim().toLowerCase() || 'pending';
}

function updatedTime(lead = {}) {
  const value = Date.parse(String(lead.updatedAt || lead.updated_at || lead.savedAt || lead.createdAt || ''));
  return Number.isFinite(value) ? value : 0;
}

function d1Changes(result = {}) {
  return Math.max(0, Number(result?.meta?.changes ?? result?.changes ?? 0));
}

function safeRestoreStatus(value = '') {
  const status = String(value || '').trim().toLowerCase();
  return RETRYABLE_DELIVERY_STATUSES.has(status) ? status : 'failed';
}

export function leadDeliveryLeaseState(lead = {}, nowMs = Date.now()) {
  const status = deliveryStatus(lead);
  if (status === 'success') {
    return { status, terminal: true, inProgress: false, stale: false, retryable: false };
  }

  if (status === DELIVERY_LEASE_STATUS) {
    const updatedAtMs = updatedTime(lead);
    const stale = updatedAtMs > 0 && Number(nowMs) - updatedAtMs >= DELIVERY_LEASE_STALE_MS;
    return {
      status,
      terminal: false,
      inProgress: !stale,
      stale,
      retryable: stale,
    };
  }

  return {
    status,
    terminal: false,
    inProgress: false,
    stale: false,
    retryable: RETRYABLE_DELIVERY_STATUSES.has(status),
  };
}

export async function acquireD1LeadDeliveryLease(db, {
  projectId = '',
  leadId = '',
  lead = {},
  nowMs = Date.now(),
} = {}) {
  if (!db?.prepare) throw new Error('D1 binding is required for delivery lease.');

  const project = String(projectId || '').trim();
  const id = String(leadId || lead.id || '').trim();
  if (!project || !id) throw new Error('Project and lead id are required for delivery lease.');

  const state = leadDeliveryLeaseState(lead, nowMs);
  if (state.terminal) return { acquired: false, terminal: true, state };
  if (state.inProgress) return { acquired: false, inProgress: true, state };
  if (!state.retryable) return { acquired: false, retryable: false, state };

  const expectedStatus = state.status || 'pending';
  const expectedUpdatedAt = String(lead.updatedAt || lead.updated_at || lead.savedAt || lead.createdAt || '');
  const leaseAt = new Date(Number(nowMs) || Date.now()).toISOString();
  const result = await db.prepare(`
    UPDATE leads
       SET delivery_status = ?, updated_at = ?
     WHERE project_id = ?
       AND id = ?
       AND COALESCE(NULLIF(delivery_status, ''), 'pending') = ?
       AND COALESCE(updated_at, '') = ?
  `).bind(
    DELIVERY_LEASE_STATUS,
    leaseAt,
    project,
    id,
    expectedStatus,
    expectedUpdatedAt,
  ).run();

  if (d1Changes(result) !== 1) {
    return {
      acquired: false,
      inProgress: true,
      raceLost: true,
      state,
    };
  }

  return {
    acquired: true,
    leaseAt,
    previousStatus: state.status === DELIVERY_LEASE_STATUS ? 'failed' : safeRestoreStatus(state.status),
    staleTakeover: state.stale,
    state,
  };
}

export async function releaseD1LeadDeliveryLease(db, {
  projectId = '',
  leadId = '',
  restoreStatus = 'failed',
  nowMs = Date.now(),
} = {}) {
  if (!db?.prepare) return false;
  const project = String(projectId || '').trim();
  const id = String(leadId || '').trim();
  if (!project || !id) return false;

  const result = await db.prepare(`
    UPDATE leads
       SET delivery_status = ?, updated_at = ?
     WHERE project_id = ?
       AND id = ?
       AND delivery_status = ?
  `).bind(
    safeRestoreStatus(restoreStatus),
    new Date(Number(nowMs) || Date.now()).toISOString(),
    project,
    id,
    DELIVERY_LEASE_STATUS,
  ).run();

  return d1Changes(result) === 1;
}

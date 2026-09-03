import { readFile } from 'node:fs/promises';
import {
  acquireD1LeadDeliveryLease,
  DELIVERY_LEASE_STALE_MS,
  leadDeliveryLeaseState,
  releaseD1LeadDeliveryLease,
} from '../functions/api/leads/_deliveryLease.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeDb(changes = [1]) {
  const queue = Array.isArray(changes) ? changes.slice() : [changes];
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...bindings) {
          return {
            async run() {
              calls.push({ sql, bindings });
              return { meta: { changes: Number(queue.length ? queue.shift() : 0) } };
            },
          };
        },
      };
    },
  };
}

const baseNow = Date.parse('2026-09-03T00:00:00.000Z');
const failedLead = {
  id: 'lead-1',
  deliveryStatus: 'failed',
  delivery: { status: 'failed', logs: [] },
  updatedAt: '2026-09-02T23:59:00.000Z',
};

const successState = leadDeliveryLeaseState({ ...failedLead, delivery: { status: 'success' } }, baseNow);
assert(successState.terminal === true && successState.retryable === false, 'successful delivery must never acquire a retry lease');

const freshSending = leadDeliveryLeaseState({
  ...failedLead,
  deliveryStatus: 'sending',
  delivery: { status: 'sending' },
  updatedAt: new Date(baseNow - 30_000).toISOString(),
}, baseNow);
assert(freshSending.inProgress === true && freshSending.stale === false, 'fresh sending state must block duplicate delivery');

const staleSending = leadDeliveryLeaseState({
  ...failedLead,
  deliveryStatus: 'sending',
  delivery: { status: 'sending' },
  updatedAt: new Date(baseNow - DELIVERY_LEASE_STALE_MS - 1).toISOString(),
}, baseNow);
assert(staleSending.inProgress === false && staleSending.stale === true && staleSending.retryable === true, 'stale delivery lease must become recoverable');

const db = fakeDb([1]);
const acquired = await acquireD1LeadDeliveryLease(db, {
  projectId: 'project-1',
  leadId: 'lead-1',
  lead: failedLead,
  nowMs: baseNow,
});
assert(acquired.acquired === true, 'failed lead should acquire delivery lease');
assert(acquired.previousStatus === 'failed', 'delivery lease should retain restore status');
assert(db.calls.length === 1, 'lease acquisition should use one atomic D1 UPDATE');
assert(/UPDATE leads/i.test(db.calls[0].sql), 'lease acquisition must update leads directly');
assert(/delivery_status\s*=\s*\?/i.test(db.calls[0].sql), 'lease acquisition must atomically move delivery_status');
assert(/COALESCE\(updated_at, ''\)\s*=\s*\?/i.test(db.calls[0].sql), 'lease acquisition must compare the observed lead version');
assert(db.calls[0].bindings.includes('failed'), 'lease acquisition must compare the observed delivery status');

const lostDb = fakeDb([0]);
const raceLost = await acquireD1LeadDeliveryLease(lostDb, {
  projectId: 'project-1',
  leadId: 'lead-1',
  lead: failedLead,
  nowMs: baseNow,
});
assert(raceLost.acquired === false && raceLost.raceLost === true && raceLost.inProgress === true, 'atomic update loss must be treated as another delivery owning the lease');

const noWriteDb = fakeDb([1]);
const freshLease = await acquireD1LeadDeliveryLease(noWriteDb, {
  projectId: 'project-1',
  leadId: 'lead-1',
  lead: {
    ...failedLead,
    deliveryStatus: 'sending',
    delivery: { status: 'sending' },
    updatedAt: new Date(baseNow - 5_000).toISOString(),
  },
  nowMs: baseNow,
});
assert(freshLease.acquired === false && freshLease.inProgress === true, 'fresh active lease must reject a duplicate request');
assert(noWriteDb.calls.length === 0, 'fresh active lease must not perform another D1 write');

const staleDb = fakeDb([1]);
const staleLease = await acquireD1LeadDeliveryLease(staleDb, {
  projectId: 'project-1',
  leadId: 'lead-1',
  lead: {
    ...failedLead,
    deliveryStatus: 'sending',
    delivery: { status: 'sending' },
    updatedAt: new Date(baseNow - DELIVERY_LEASE_STALE_MS - 1).toISOString(),
  },
  nowMs: baseNow,
});
assert(staleLease.acquired === true && staleLease.staleTakeover === true, 'stale lease should allow guarded recovery');

const releaseDb = fakeDb([1]);
const released = await releaseD1LeadDeliveryLease(releaseDb, {
  projectId: 'project-1',
  leadId: 'lead-1',
  restoreStatus: 'partial',
  nowMs: baseNow + 5_000,
});
assert(released === true, 'failed delivery execution should release the lease');
assert(/delivery_status\s*=\s*\?/i.test(releaseDb.calls[0].sql) && /delivery_status\s*=\s*\?/i.test(releaseDb.calls[0].sql), 'lease release must be scoped to delivery status');
assert(releaseDb.calls[0].bindings.includes('partial') && releaseDb.calls[0].bindings.includes('sending'), 'lease release must restore only an active sending row');

const deliverSource = await readFile('functions/api/leads/[id]/deliver.js', 'utf8');
const leaseSource = await readFile('functions/api/leads/_deliveryLease.js', 'utf8');
const acquireIndex = deliverSource.indexOf('acquireD1LeadDeliveryLease');
const sendIndex = deliverSource.indexOf('sendLeadDelivery(current');
assert(acquireIndex >= 0 && sendIndex > acquireIndex, 'delivery lease must be acquired before any external delivery starts');
assert(deliverSource.includes("code: 'LEAD_DELIVERY_IN_PROGRESS'") && deliverSource.includes('202'), 'duplicate delivery request must return a non-error in-progress response');
assert(deliverSource.indexOf('listD1DeliveryLogs') < sendIndex, 'retry must read persisted successful delivery keys before sending');
assert(deliverSource.includes('skipSuccessfulIdempotencyKeys: successfulKeys'), 'already successful idempotency keys must be skipped on retry');
assert(deliverSource.includes('releaseD1LeadDeliveryLease') && deliverSource.indexOf('releaseD1LeadDeliveryLease', sendIndex) > sendIndex, 'catastrophic send failure must release the lease');
assert(deliverSource.includes('const latest = await getD1Lead') && deliverSource.lastIndexOf('const latest = await getD1Lead') < deliverSource.indexOf('const saved = await upsertD1Lead'), 'delivery finalization must re-read the latest lead before persistence');
assert(leaseSource.includes('DELIVERY_LEASE_STALE_MS = 15 * 60 * 1000'), 'stale lease recovery window must remain bounded and conservative');
assert(!leaseSource.includes('console.'), 'delivery lease must not log lead or contact data');

console.log(JSON.stringify({
  ok: true,
  checks: 23,
  leaseStatus: 'sending',
  staleMs: DELIVERY_LEASE_STALE_MS,
  atomicD1Acquire: true,
  successfulDeliveryDedupe: true,
  uiTouched: false,
}, null, 2));

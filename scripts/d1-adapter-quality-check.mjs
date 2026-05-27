import {
  createStorageRuntime,
  storageRuntimeHealth,
  storageRuntimePlan,
} from '../server/storage/runtimeAdapter.mjs';
import {
  decodeD1Event,
  decodeD1Lead,
  encodeD1Event,
  encodeD1Lead,
  insertD1Event,
  listD1Events,
  listD1Leads,
  upsertD1Lead,
} from '../server/storage/d1Adapter.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeD1() {
  const rows = {
    leads: [],
    events: [],
  };
  return {
    rows,
    prepare(sql) {
      return {
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO leads')) {
            const [
              id,
              project_id,
              page_id,
              page_slug,
              kind,
              status,
              name,
              phone,
              email,
              contact_key,
              values_json,
              delivery_status,
              source_url,
              created_month,
              created_at,
              updated_at,
            ] = this.params;
            const next = {
              id,
              project_id,
              page_id,
              page_slug,
              kind,
              status,
              name,
              phone,
              email,
              contact_key,
              values_json,
              delivery_status,
              source_url,
              created_month,
              created_at,
              updated_at,
            };
            const index = rows.leads.findIndex((row) => row.id === id);
            if (index >= 0) rows.leads[index] = { ...rows.leads[index], ...next };
            else rows.leads.push(next);
            return { success: true };
          }
          if (sql.includes('INSERT OR IGNORE INTO events')) {
            const [
              id,
              project_id,
              page_id,
              page_slug,
              event_type,
              visitor_id,
              session_id,
              dedupe_key,
              payload_json,
              created_month,
              created_at,
            ] = this.params;
            if (!rows.events.some((row) => row.id === id)) {
              rows.events.push({
                id,
                project_id,
                page_id,
                page_slug,
                event_type,
                visitor_id,
                session_id,
                dedupe_key,
                payload_json,
                created_month,
                created_at,
              });
            }
            return { success: true };
          }
          throw new Error(`Unexpected fake D1 run SQL: ${sql}`);
        },
        async all() {
          if (sql.includes('FROM leads')) {
            const [projectId, month, maybeStatus, maybeLimit, maybeOffset] = this.params;
            const hasStatus = sql.includes('status = ?');
            const limit = Number(hasStatus ? maybeLimit : maybeStatus);
            const offset = Number(hasStatus ? maybeOffset : maybeLimit);
            const status = hasStatus ? maybeStatus : '';
            const filtered = rows.leads
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => !status || row.status === status)
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(offset, offset + limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM events')) {
            const [projectId, month, maybeEventType, maybeLimit, maybeOffset] = this.params;
            const hasEventType = sql.includes('event_type = ?');
            const limit = Number(hasEventType ? maybeLimit : maybeEventType);
            const offset = Number(hasEventType ? maybeOffset : maybeLimit);
            const eventType = hasEventType ? maybeEventType : '';
            const filtered = rows.events
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => !eventType || row.event_type === eventType)
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(offset, offset + limit), meta: { rows_read: filtered.length } };
          }
          throw new Error(`Unexpected fake D1 all SQL: ${sql}`);
        },
        async first() {
          if (sql.includes('COUNT(*) AS total FROM leads')) {
            const [projectId, month, status = ''] = this.params;
            return {
              total: rows.leads
                .filter((row) => row.project_id === projectId && row.created_month === month)
                .filter((row) => !sql.includes('status = ?') || row.status === status)
                .length,
            };
          }
          if (sql.includes('COUNT(*) AS total FROM events')) {
            const [projectId, month, eventType = ''] = this.params;
            return {
              total: rows.events
                .filter((row) => row.project_id === projectId && row.created_month === month)
                .filter((row) => !sql.includes('event_type = ?') || row.event_type === eventType)
                .length,
            };
          }
          return null;
        },
      };
    },
  };
}

const sampleLead = {
  id: 'lead-1',
  name: 'Kim',
  phone: '010-1111-2222',
  email: 'kim@example.test',
  status: 'new',
  type: 'consult',
  answers: [{ label: 'budget', value: '100' }],
  values: { name: 'Kim', phone: '010-1111-2222' },
  createdAt: '2026-05-10T01:00:00.000Z',
};

const encodedLead = encodeD1Lead(sampleLead, { projectId: 'project-1', pageSlug: 'landing' });
assert(encodedLead.project_id === 'project-1', 'lead project id should encode');
assert(encodedLead.created_month === '2026-05', 'lead created month should encode');
assert(encodedLead.contact_key === '01011112222', 'lead contact key should prefer normalized phone');
assert(decodeD1Lead(encodedLead).answers.length === 1, 'lead answers should round-trip');

const encodedEvent = encodeD1Event({
  id: 'event-1',
  type: 'page_view',
  visitorId: 'visitor-1',
  createdAt: '2026-05-10T02:00:00.000Z',
}, { projectId: 'project-1', pageSlug: 'landing' });
assert(encodedEvent.event_type === 'page_view', 'event type should encode');
assert(decodeD1Event(encodedEvent).visitorId === 'visitor-1', 'event visitor should round-trip');

const db = fakeD1();
await upsertD1Lead(db, sampleLead, { projectId: 'project-1', pageSlug: 'landing' });
await upsertD1Lead(db, { ...sampleLead, status: 'checked' }, { projectId: 'project-1', pageSlug: 'landing' });
assert(db.rows.leads.length === 1 && db.rows.leads[0].status === 'checked', 'lead upsert should update existing row');

const leadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', limit: 10 });
assert(leadPage.records.length === 1 && leadPage.total === 1, 'lead list should return one decoded row');
assert(leadPage.records[0].phone === '010-1111-2222', 'lead list should decode original lead');

await insertD1Event(db, { id: 'event-1', type: 'page_view', createdAt: '2026-05-10T02:00:00.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
await insertD1Event(db, { id: 'event-1', type: 'page_view', createdAt: '2026-05-10T02:00:00.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
assert(db.rows.events.length === 1, 'event insert should ignore duplicate ids');

const eventPage = await listD1Events(db, { projectId: 'project-1', month: '2026-05', eventType: 'page_view', limit: 10 });
assert(eventPage.records.length === 1 && eventPage.records[0].type === 'page_view', 'event list should decode events');

const missingRuntime = createStorageRuntime({ INLET_STORAGE_ADAPTER: 'd1' });
const missingHealth = storageRuntimeHealth(missingRuntime);
assert(missingHealth.requested === 'd1' && missingHealth.active === 'jsonl' && missingHealth.fallback, 'missing D1 binding should fallback to jsonl');
const missingPlan = storageRuntimePlan(missingRuntime, 'leads', { month: '2026-05' });
assert(missingPlan.adapter === 'd1' && missingPlan.available === false && missingPlan.fallbackAdapter === 'jsonl', 'missing D1 plan should expose unavailable d1');

const readyRuntime = createStorageRuntime({ INLET_STORAGE_ADAPTER: 'auto', DB: db });
const readyPlan = storageRuntimePlan(readyRuntime, 'leads', { month: '2026-05' });
assert(readyRuntime.active === 'd1' && readyPlan.fullScan === false, 'ready D1 runtime should become indexed d1');

console.log(JSON.stringify({
  ok: true,
  checks: 18,
  leads: db.rows.leads.length,
  events: db.rows.events.length,
  storageModes: ['jsonl', 'd1', 'auto'],
}, null, 2));


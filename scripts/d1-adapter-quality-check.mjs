import {
  createStorageRuntime,
  storageRuntimeCoverage,
  storageRuntimeHealth,
  storageRuntimePlan,
} from '../server/storage/runtimeAdapter.mjs';
import {
  aggregateD1Stats,
  decodeD1AiDraft,
  decodeD1Account,
  decodeD1Event,
  decodeD1Invite,
  decodeD1Lead,
  decodeD1OwnershipTransferRequest,
  decodeD1Page,
  decodeD1PageRevision,
  decodeD1ProjectMember,
  decodeD1Project,
  deleteD1AiDraft,
  deleteD1Lead,
  encodeD1AiDraft,
  encodeD1Account,
  encodeD1Event,
  encodeD1Invite,
  encodeD1Lead,
  encodeD1OwnershipTransferRequest,
  encodeD1Page,
  encodeD1PageRevision,
  encodeD1ProjectMember,
  encodeD1Project,
  findD1LeadsByContact,
  findD1LeadsByIntakeSignals,
  getD1AccountByEmail,
  getD1AccountByPhone,
  getD1Lead,
  getD1LatestPageByProject,
  getD1PageBySlug,
  getD1PageRevision,
  getD1PublicPageBySlug,
  getD1ProjectAccess,
  getD1ProjectById,
  getD1ProjectBySlug,
  listD1AiDrafts,
  insertD1Event,
  insertD1PageRevision,
  listD1DeliveryLogs,
  listD1DeliveryRetryQueue,
  listD1Events,
  listD1Leads,
  listD1OwnershipTransferRequests,
  listD1PageRevisions,
  listD1ProjectMembers,
  upsertD1Account,
  upsertD1AiDraft,
  upsertD1Invite,
  upsertD1Lead,
  upsertD1OwnershipTransferRequest,
  upsertD1Page,
  upsertD1Project,
  replaceD1ProjectMembers,
  upsertD1ProjectMember,
} from '../server/storage/d1Adapter.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeD1(options = {}) {
  const rows = {
    leads: [],
    events: [],
    delivery_logs: [],
    accounts: [],
    projects: [],
    invites: [],
    project_members: [],
    ownership_transfer_requests: [],
    pages: [],
    page_revisions: [],
    ai_drafts: [],
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
          if (sql.includes('INSERT INTO projects')) {
            const [
              id,
              owner_account_id,
              slug,
              title,
              client_email,
              plan,
              billing_status,
              status,
              created_at,
              updated_at,
            ] = this.params;
            const next = { id, owner_account_id, slug, title, client_email, plan, billing_status, status, created_at, updated_at };
            const index = rows.projects.findIndex((row) => row.id === id);
            if (index >= 0) rows.projects[index] = { ...rows.projects[index], ...next };
            else rows.projects.push(next);
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO accounts')) {
            const [
              id,
              email,
              phone,
              name,
              password_hash,
              email_verified_at,
              status,
              created_at,
              updated_at,
            ] = this.params;
            const next = {
              id,
              email,
              phone,
              name,
              password_hash,
              email_verified_at,
              status,
              created_at,
              updated_at,
            };
            const index = rows.accounts.findIndex((row) => row.id === id);
            if (index >= 0) rows.accounts[index] = { ...rows.accounts[index], ...next };
            else rows.accounts.push(next);
            return { success: true };
          }
          if (sql.includes('INSERT INTO invites')) {
            const [
              id,
              project_id,
              email,
              phone,
              name,
              token_hash,
              access_json,
              status,
              invited_by_account_id,
              accepted_account_id,
              expires_at,
              accepted_at,
              created_at,
              updated_at,
            ] = this.params;
            const next = { id, project_id, email, phone, name, token_hash, access_json, status, invited_by_account_id, accepted_account_id, expires_at, accepted_at, created_at, updated_at };
            const index = rows.invites.findIndex((row) => row.id === id);
            if (index >= 0) rows.invites[index] = { ...rows.invites[index], ...next };
            else rows.invites.push(next);
            return { success: true };
          }
          if (sql.includes('INSERT INTO project_members')) {
            const [
              id,
              project_id,
              account_id,
              role,
              access_json,
              status,
              invited_by_account_id,
              created_at,
              updated_at,
            ] = this.params;
            const next = { id, project_id, account_id, role, access_json, status, invited_by_account_id, created_at, updated_at };
            const index = rows.project_members.findIndex((row) => row.project_id === project_id && row.account_id === account_id);
            if (index >= 0) rows.project_members[index] = { ...rows.project_members[index], ...next };
            else rows.project_members.push(next);
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE project_members') && sql.includes("SET status = 'removed'")) {
            const params = this.params.slice();
            const updatedAt = params.shift();
            const projectId = params.shift();
            const roleCount = (sql.match(/\?/g) || []).length - 2 - (sql.includes('account_id NOT IN') ? (sql.match(/account_id NOT IN \(([^)]+)\)/)?.[1].match(/\?/g) || []).length : 0);
            const roles = params.splice(0, roleCount);
            const keepIds = params;
            let changes = 0;
            for (const row of rows.project_members) {
              if (row.project_id === projectId && roles.includes(row.role) && !keepIds.includes(row.account_id)) {
                if (row.status !== 'removed') changes += 1;
                row.status = 'removed';
                row.updated_at = updatedAt;
              }
            }
            return { success: true, meta: { changes } };
          }
          if (sql.includes('INSERT INTO ownership_transfer_requests')) {
            const [
              id,
              project_id,
              from_account_id,
              to_account_id,
              requested_by_account_id,
              approved_by_account_id,
              status,
              billing_clearance_status,
              note,
              requested_at,
              approved_at,
              completed_at,
            ] = this.params;
            const next = { id, project_id, from_account_id, to_account_id, requested_by_account_id, approved_by_account_id, status, billing_clearance_status, note, requested_at, approved_at, completed_at };
            const index = rows.ownership_transfer_requests.findIndex((row) => row.id === id);
            if (index >= 0) rows.ownership_transfer_requests[index] = { ...rows.ownership_transfer_requests[index], ...next };
            else rows.ownership_transfer_requests.push(next);
            return { success: true };
          }
          if (sql.includes('UPDATE pages')) {
            const [
              project_id,
              slug,
              title,
              page_json,
              revision,
              published_at,
              updated_at,
              id,
            ] = this.params;
            const index = rows.pages.findIndex((row) => row.id === id);
            if (index >= 0) {
              rows.pages[index] = {
                ...rows.pages[index],
                project_id,
                slug,
                title,
                page_json,
                revision,
                published_at,
                updated_at,
              };
            }
            return { success: true, meta: { changes: index >= 0 ? 1 : 0 } };
          }
          if (sql.includes('INSERT INTO pages')) {
            const [
              id,
              project_id,
              slug,
              title,
              page_json,
              revision,
              published_at,
              created_at,
              updated_at,
            ] = this.params;
            const next = { id, project_id, slug, title, page_json, revision, published_at, created_at, updated_at };
            const idIndex = rows.pages.findIndex((row) => row.id === id);
            const slugIndex = rows.pages.findIndex((row) => row.project_id === project_id && row.slug === slug);
            const index = idIndex >= 0 ? idIndex : slugIndex;
            if (index >= 0) rows.pages[index] = { ...rows.pages[index], ...next, id: rows.pages[index].id };
            else rows.pages.push(next);
            return { success: true };
          }
          if (sql.includes('INSERT OR IGNORE INTO page_revisions')) {
            const [
              id,
              page_id,
              project_id,
              revision,
              page_json,
              reason,
              created_by_account_id,
              created_at,
            ] = this.params;
            if (!rows.page_revisions.some((row) => row.page_id === page_id && row.revision === revision)) {
              rows.page_revisions.push({ id, page_id, project_id, revision, page_json, reason, created_by_account_id, created_at });
            }
            return { success: true };
          }
          if (sql.includes('INSERT INTO ai_drafts')) {
            const [
              id,
              project_id,
              prompt_hash,
              draft_json,
              status,
              created_by_account_id,
              created_at,
            ] = this.params;
            const next = { id, project_id, prompt_hash, draft_json, status, created_by_account_id, created_at };
            const index = rows.ai_drafts.findIndex((row) => row.id === id);
            if (index >= 0) rows.ai_drafts[index] = { ...rows.ai_drafts[index], ...next };
            else rows.ai_drafts.push(next);
            return { success: true };
          }
          if (sql.includes("UPDATE ai_drafts SET status = 'deleted'")) {
            const [projectId, id] = this.params;
            const draft = rows.ai_drafts.find((row) => row.project_id === projectId && row.id === id);
            if (draft) draft.status = 'deleted';
            return { success: true };
          }
          if (sql.includes('INSERT INTO leads')) {
            if (options.legacyLeadSchema && sql.includes('client_id')) {
              throw new Error('table leads has no column named client_id');
            }
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
              client_id,
              ip_hash,
              user_agent_hash,
              phone_normalized,
              email_normalized,
              duplicate,
              duplicate_reason,
              risk_score,
              submitted_at,
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
              client_id,
              ip_hash,
              user_agent_hash,
              phone_normalized,
              email_normalized,
              duplicate,
              duplicate_reason,
              risk_score,
              submitted_at,
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
            if (options.legacyEventSchema && sql.includes('channel')) {
              throw new Error('table events has no column named channel');
            }
            const [
              id,
              project_id,
              page_id,
              page_slug,
              event_type,
              visitor_id,
              session_id,
              dedupe_key,
            ] = this.params;
            let payload_json;
            let created_month;
            let created_at;
            let channel = 'direct';
            let device = 'unknown';
            if (sql.includes('channel')) {
              [channel, device, payload_json, created_month, created_at] = this.params.slice(8);
            } else {
              [payload_json, created_month, created_at] = this.params.slice(8);
            }
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
                channel,
                device,
                payload_json,
                created_month,
                created_at,
              });
            }
            return { success: true };
          }
          if (sql.includes('INSERT INTO delivery_logs')) {
            const [
              id,
              project_id,
              lead_id,
              provider,
              target,
              status,
              retryable,
              attempts,
              idempotency_key,
              error,
              next_retry_at,
              created_month,
              created_at,
              updated_at,
            ] = this.params;
            const next = {
              id,
              project_id,
              lead_id,
              provider,
              target,
              status,
              retryable,
              attempts,
              idempotency_key,
              error,
              next_retry_at,
              created_month,
              created_at,
              updated_at,
            };
            const index = rows.delivery_logs.findIndex((row) => row.id === id);
            if (index >= 0) rows.delivery_logs[index] = { ...rows.delivery_logs[index], ...next };
            else rows.delivery_logs.push(next);
            return { success: true };
          }
          if (sql.includes('DELETE FROM leads')) {
            const [projectId, id] = this.params;
            const index = rows.leads.findIndex((row) => row.project_id === projectId && row.id === id);
            if (index >= 0) rows.leads.splice(index, 1);
            return { success: true };
          }
          throw new Error(`Unexpected fake D1 run SQL: ${sql}`);
        },
        async all() {
          if (sql.includes('FROM project_members')) {
            const [projectId, removed] = this.params;
            const filtered = rows.project_members
              .filter((row) => row.project_id === projectId && row.status !== removed)
              .sort((a, b) => `${a.role}:${a.created_at}`.localeCompare(`${b.role}:${b.created_at}`));
            return { results: filtered, meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM ai_drafts')) {
            const [projectId, limit, offset] = this.params;
            const includeDeleted = !sql.includes("status <> 'deleted'");
            const filtered = rows.ai_drafts
              .filter((row) => row.project_id === projectId)
              .filter((row) => includeDeleted || row.status !== 'deleted')
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(offset, offset + limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM page_revisions')) {
            const [projectId, pageId, limit, offset] = this.params;
            const filtered = rows.page_revisions
              .filter((row) => row.project_id === projectId && row.page_id === pageId)
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(offset, offset + limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM ownership_transfer_requests')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const hasStatus = sql.includes('status = ?');
            const status = hasStatus ? this.params[paramIndex++] : '';
            const hasTarget = sql.includes('to_account_id = ?');
            const target = hasTarget ? this.params[paramIndex++] : '';
            const limit = Number(this.params[paramIndex++]);
            const offset = Number(this.params[paramIndex++]);
            const filtered = rows.ownership_transfer_requests
              .filter((row) => row.project_id === projectId)
              .filter((row) => !status || row.status === status)
              .filter((row) => !target || row.to_account_id === target)
              .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
            return { results: filtered.slice(offset, offset + limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM delivery_logs') && sql.includes('GROUP BY status, retryable')) {
            const [projectId] = this.params;
            const statusFilter = sql.includes('status = ?') ? this.params[1] : '';
            const deadOnly = sql.includes("AND status = 'dead-letter'");
            const grouped = new Map();
            rows.delivery_logs
              .filter((row) => row.project_id === projectId)
              .filter((row) => row.retryable === 1 || row.status === 'dead-letter')
              .filter((row) => !deadOnly || row.status === 'dead-letter')
              .filter((row) => !statusFilter || row.status === statusFilter)
              .forEach((row) => {
                const key = `${row.status}|${row.retryable}`;
                const prev = grouped.get(key) || { status: row.status, retryable: row.retryable, total: 0 };
                prev.total += 1;
                grouped.set(key, prev);
              });
            return { results: Array.from(grouped.values()), meta: { rows_read: rows.delivery_logs.length } };
          }
          if (sql.includes('FROM delivery_logs')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const hasMonth = sql.includes('created_month = ?');
            const month = hasMonth ? this.params[paramIndex++] : '';
            const hasLead = sql.includes('lead_id = ?');
            const leadId = hasLead ? this.params[paramIndex++] : '';
            const hasStatus = sql.includes('status = ?');
            const status = hasStatus ? this.params[paramIndex++] : '';
            const retryOnly = sql.includes('retryable = 1');
            const deadOnly = sql.includes("AND status = 'dead-letter'");
            const limit = Number(this.params[paramIndex++]);
            const offset = Number(this.params[paramIndex++]);
            const filtered = rows.delivery_logs
              .filter((row) => row.project_id === projectId)
              .filter((row) => !month || row.created_month === month)
              .filter((row) => !leadId || row.lead_id === leadId)
              .filter((row) => !status || row.status === status)
              .filter((row) => !retryOnly || row.retryable === 1 || row.status === 'dead-letter')
              .filter((row) => !deadOnly || row.status === 'dead-letter')
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(offset, offset + limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM events') && sql.includes('GROUP BY event_type')) {
            const [projectId, month, dateFrom = '', dateTo = ''] = this.params;
            const grouped = new Map();
            const seen = new Set();
            rows.events
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
              .forEach((row) => {
                const key = `${row.event_type}:${fakeEventDedupeKey(row)}`;
                if (seen.has(key)) return;
                seen.add(key);
                grouped.set(row.event_type, (grouped.get(row.event_type) || 0) + 1);
              });
            return {
              results: Array.from(grouped.entries()).map(([event_type, total]) => ({ event_type, total })),
              meta: { rows_read: rows.events.length },
            };
          }
          if (sql.includes('FROM events') && sql.includes('GROUP BY name')) {
            const [projectId, month, dateFrom = '', dateTo = ''] = this.params;
            const dimension = sql.includes('device') ? 'device' : 'channel';
            const grouped = new Map();
            const seen = new Set();
            rows.events
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
              .forEach((row) => {
                const name = row[dimension] || 'unknown';
                const key = `${dimension}:${name}:${fakeEventDedupeKey(row)}`;
                if (seen.has(key)) return;
                seen.add(key);
                grouped.set(name, (grouped.get(name) || 0) + 1);
              });
            return {
              results: Array.from(grouped.entries()).map(([name, total]) => ({ name, total })),
              meta: { rows_read: rows.events.length },
            };
          }
          if (sql.includes('FROM events') && sql.includes('GROUP BY day')) {
            const [projectId, month, dateFrom = '', dateTo = ''] = this.params;
            const grouped = new Map();
            const seen = new Set();
            rows.events
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
              .forEach((row) => {
                const day = row.created_at.slice(0, 10);
                const key = `${day}:${row.event_type}:${fakeEventDedupeKey(row)}`;
                if (seen.has(key)) return;
                seen.add(key);
                const prev = grouped.get(day) || { day, pv: 0, cta: 0 };
                if (row.event_type === 'page_view') prev.pv += 1;
                if (row.event_type === 'cta_click') prev.cta += 1;
                grouped.set(day, prev);
              });
            return { results: Array.from(grouped.values()), meta: { rows_read: rows.events.length } };
          }
          if (sql.includes('FROM leads') && sql.includes('GROUP BY status, kind, delivery_status')) {
            const [projectId, month, dateFrom = '', dateTo = ''] = this.params;
            const grouped = new Map();
            rows.leads
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
              .forEach((row) => {
                const key = [row.status, row.kind, row.delivery_status].join('|');
                const prev = grouped.get(key) || {
                  status: row.status,
                  kind: row.kind,
                  delivery_status: row.delivery_status,
                  total: 0,
                };
                prev.total += 1;
                grouped.set(key, prev);
              });
            return { results: Array.from(grouped.values()), meta: { rows_read: rows.leads.length } };
          }
          if (sql.includes('FROM leads') && sql.includes('GROUP BY day')) {
            const [projectId, month, dateFrom = '', dateTo = ''] = this.params;
            const grouped = new Map();
            rows.leads
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
              .forEach((row) => {
                const day = row.created_at.slice(0, 10);
                const prev = grouped.get(day) || { day, db: 0 };
                prev.db += 1;
                grouped.set(day, prev);
              });
            return { results: Array.from(grouped.values()), meta: { rows_read: rows.leads.length } };
          }
          if (sql.includes('FROM leads') && sql.includes('phone_normalized = ?')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const month = this.params[paramIndex++];
            const hasPage = sql.includes('page_slug = ?');
            const pageSlug = hasPage ? this.params[paramIndex++] : '';
            const signalValues = new Set(this.params.slice(paramIndex, -1).map((value) => String(value || '').toLowerCase()));
            const limit = Number(this.params[this.params.length - 1]);
            const filtered = rows.leads
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => !pageSlug || row.page_slug === pageSlug)
              .filter((row) => {
                const phone = String(row.phone_normalized || row.phone || '').replace(/\D/g, '').toLowerCase();
                const email = String(row.email_normalized || row.email || '').trim().toLowerCase();
                const contact = String(row.contact_key || '').trim().toLowerCase();
                const client = String(row.client_id || '').trim().toLowerCase();
                const ip = String(row.ip_hash || '').trim().toLowerCase();
                return [phone, email, contact, client, ip].some((value) => signalValues.has(value));
              })
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(0, limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM leads') && sql.includes('ORDER BY created_at DESC LIMIT ?') && sql.includes('contact_key = ?')) {
            const [projectId, month] = this.params;
            const limit = Number(this.params[this.params.length - 1]);
            const contacts = new Set(this.params.slice(2, -1).map((value) => String(value || '').toLowerCase()));
            const filtered = rows.leads
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => {
                const phone = String(row.phone || '').replace(/\D/g, '').toLowerCase();
                const email = String(row.email || '').trim().toLowerCase();
                const contact = String(row.contact_key || '').trim().toLowerCase();
                return contacts.has(phone) || contacts.has(email) || contacts.has(contact);
              })
              .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            return { results: filtered.slice(0, limit), meta: { rows_read: filtered.length } };
          }
          if (sql.includes('FROM leads')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const month = this.params[paramIndex++];
            const hasDateFrom = sql.includes('created_at >= ?');
            const dateFrom = hasDateFrom ? this.params[paramIndex++] : '';
            const hasDateTo = sql.includes('created_at <= ?');
            const dateTo = hasDateTo ? this.params[paramIndex++] : '';
            const hasChannel = sql.includes('source_url LIKE ?');
            const channel = hasChannel ? String(this.params[paramIndex++]).replace(/%/g, '').replace(/^utm_source=/, '').toLowerCase() : '';
            const directChannel = sql.includes("source_url NOT LIKE '%utm_source=%'");
            const hasStatus = sql.includes('status = ?');
            const status = hasStatus ? this.params[paramIndex++] : '';
            const hasKind = sql.includes('kind = ?');
            const kind = hasKind ? this.params[paramIndex++] : '';
            const hasDeliveryStatus = sql.includes('delivery_status = ?');
            const deliveryStatus = hasDeliveryStatus ? this.params[paramIndex++] : '';
            const hasSearch = sql.includes('LOWER(name) LIKE ?');
            const search = hasSearch ? String(this.params[paramIndex++]).replace(/%/g, '').toLowerCase() : '';
            if (hasSearch) paramIndex += 4;
            const limit = Number(this.params[paramIndex++]);
            const offset = Number(this.params[paramIndex++]);
            const filtered = rows.leads
              .filter((row) => row.project_id === projectId && row.created_month === month)
              .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
              .filter((row) => !directChannel || !String(row.source_url || '').includes('utm_source='))
              .filter((row) => !channel || String(row.source_url || '').toLowerCase().includes(`utm_source=${channel}`))
              .filter((row) => !status || row.status === status)
              .filter((row) => !kind || row.kind === kind)
              .filter((row) => !deliveryStatus || row.delivery_status === deliveryStatus)
              .filter((row) => !search || fakeLeadSearchText(row).includes(search))
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
          if (sql.includes('SELECT * FROM accounts WHERE email = ?')) {
            const [email] = this.params;
            return rows.accounts.find((row) => row.email === email) || null;
          }
          if (sql.includes('SELECT * FROM accounts WHERE phone = ?')) {
            const [phone] = this.params;
            return rows.accounts.find((row) => row.phone === phone) || null;
          }
          if (sql.includes('SELECT * FROM projects WHERE id = ?')) {
            const [projectId] = this.params;
            return rows.projects.find((row) => row.id === projectId) || null;
          }
          if (sql.includes('SELECT * FROM projects WHERE slug = ?')) {
            const [slug] = this.params;
            return rows.projects.find((row) => row.slug === slug) || null;
          }
          if (sql.includes('SELECT * FROM pages WHERE project_id = ? AND slug = ?')) {
            const [projectId, slug] = this.params;
            return rows.pages.find((row) => row.project_id === projectId && row.slug === slug) || null;
          }
          if (sql.includes('SELECT * FROM pages WHERE slug = ? ORDER BY updated_at DESC')) {
            const [slug] = this.params;
            return rows.pages
              .map((row, index) => ({ row, index }))
              .filter((entry) => entry.row.slug === slug)
              .sort((a, b) => {
                const updated = String(b.row.updated_at || '').localeCompare(String(a.row.updated_at || ''));
                if (updated) return updated;
                const revision = Number(b.row.revision || 0) - Number(a.row.revision || 0);
                if (revision) return revision;
                return b.index - a.index;
              })[0]?.row || null;
          }
          if (sql.includes('SELECT * FROM pages WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1')) {
            const [projectId] = this.params;
            return rows.pages.filter((row) => row.project_id === projectId).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0] || null;
          }
          if (sql.includes('SELECT id, project_id, slug, revision, created_at FROM pages WHERE project_id = ? AND slug = ?')) {
            const [projectId, slug] = this.params;
            const page = rows.pages.find((row) => row.project_id === projectId && row.slug === slug);
            return page ? { id: page.id, project_id: page.project_id, slug: page.slug, revision: page.revision, created_at: page.created_at } : null;
          }
          if (sql.includes('SELECT id, project_id, slug, revision, created_at FROM pages WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1')) {
            const [projectId] = this.params;
            const page = rows.pages.filter((row) => row.project_id === projectId).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0];
            return page ? { id: page.id, project_id: page.project_id, slug: page.slug, revision: page.revision, created_at: page.created_at } : null;
          }
          if (sql.includes('SELECT id, project_id, slug, revision, created_at FROM pages WHERE id = ?')) {
            const [id] = this.params;
            const page = rows.pages.find((row) => row.id === id);
            return page ? { id: page.id, project_id: page.project_id, slug: page.slug, revision: page.revision, created_at: page.created_at } : null;
          }
          if (sql.includes('SELECT id FROM pages')) {
            const [projectId, slug] = this.params;
            const page = rows.pages.find((row) => row.project_id === projectId && row.slug === slug);
            return page ? { id: page.id } : null;
          }
          if (sql.includes('SELECT * FROM page_revisions')) {
            const [projectId, pageId, id] = this.params;
            return rows.page_revisions.find((row) => row.project_id === projectId && row.page_id === pageId && row.id === id) || null;
          }
          if (sql.includes('SELECT * FROM leads')) {
            const [projectId, id] = this.params;
            return rows.leads.find((row) => row.project_id === projectId && row.id === id) || null;
          }
          if (sql.includes('COUNT(*) AS total FROM ownership_transfer_requests')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const hasStatus = sql.includes('status = ?');
            const status = hasStatus ? this.params[paramIndex++] : '';
            const hasTarget = sql.includes('to_account_id = ?');
            const target = hasTarget ? this.params[paramIndex++] : '';
            return {
              total: rows.ownership_transfer_requests
                .filter((row) => row.project_id === projectId)
                .filter((row) => !status || row.status === status)
                .filter((row) => !target || row.to_account_id === target)
                .length,
            };
          }
          if (sql.includes('COUNT(*) AS total FROM delivery_logs')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const hasMonth = sql.includes('created_month = ?');
            const month = hasMonth ? this.params[paramIndex++] : '';
            const hasLead = sql.includes('lead_id = ?');
            const leadId = hasLead ? this.params[paramIndex++] : '';
            const hasStatus = sql.includes('status = ?');
            const status = hasStatus ? this.params[paramIndex++] : '';
            return {
              total: rows.delivery_logs
                .filter((row) => row.project_id === projectId)
                .filter((row) => !month || row.created_month === month)
                .filter((row) => !leadId || row.lead_id === leadId)
                .filter((row) => !status || row.status === status)
                .length,
            };
          }
          if (sql.includes('COUNT(*) AS total FROM leads')) {
            let paramIndex = 0;
            const projectId = this.params[paramIndex++];
            const month = this.params[paramIndex++];
            const hasDateFrom = sql.includes('created_at >= ?');
            const dateFrom = hasDateFrom ? this.params[paramIndex++] : '';
            const hasDateTo = sql.includes('created_at <= ?');
            const dateTo = hasDateTo ? this.params[paramIndex++] : '';
            const hasChannel = sql.includes('source_url LIKE ?');
            const channel = hasChannel ? String(this.params[paramIndex++]).replace(/%/g, '').replace(/^utm_source=/, '').toLowerCase() : '';
            const directChannel = sql.includes("source_url NOT LIKE '%utm_source=%'");
            const hasStatus = sql.includes('status = ?');
            const status = hasStatus ? this.params[paramIndex++] : '';
            const hasKind = sql.includes('kind = ?');
            const kind = hasKind ? this.params[paramIndex++] : '';
            const hasDeliveryStatus = sql.includes('delivery_status = ?');
            const deliveryStatus = hasDeliveryStatus ? this.params[paramIndex++] : '';
            const hasSearch = sql.includes('LOWER(name) LIKE ?');
            const search = hasSearch ? String(this.params[paramIndex++]).replace(/%/g, '').toLowerCase() : '';
            return {
              total: rows.leads
                .filter((row) => row.project_id === projectId && row.created_month === month)
                .filter((row) => inFakeDateRange(row, dateFrom, dateTo))
                .filter((row) => !directChannel || !String(row.source_url || '').includes('utm_source='))
                .filter((row) => !channel || String(row.source_url || '').toLowerCase().includes(`utm_source=${channel}`))
                .filter((row) => !hasStatus || row.status === status)
                .filter((row) => !hasKind || row.kind === kind)
                .filter((row) => !hasDeliveryStatus || row.delivery_status === deliveryStatus)
                .filter((row) => !hasSearch || fakeLeadSearchText(row).includes(search))
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

function inFakeDateRange(row, dateFrom = '', dateTo = '') {
  if (dateFrom && String(row.created_at) < String(dateFrom)) return false;
  if (dateTo && String(row.created_at) > String(dateTo)) return false;
  return true;
}

function fakeEventDedupeKey(row = {}) {
  return row.dedupe_key || row.id;
}

function fakeLeadSearchText(row = {}) {
  return [
    row.name,
    row.phone,
    row.email,
    row.contact_key,
    row.values_json,
  ].join(' ').toLowerCase();
}

const sampleLead = {
  id: 'lead-1',
  name: 'Kim',
  phone: '010-1111-2222',
  email: 'kim@example.test',
  status: 'new',
  type: 'consult',
  clientId: 'client-1',
  ipHash: 'ip-hash-1',
  userAgentHash: 'ua-hash-1',
  duplicate: true,
  duplicateReason: 'phone_30d',
  riskScore: 30,
  answers: [{ label: 'budget', value: '100' }],
  values: { name: 'Kim', phone: '010-1111-2222' },
  createdAt: '2026-05-10T01:00:00.000Z',
};

const encodedLead = encodeD1Lead(sampleLead, { projectId: 'project-1', pageSlug: 'landing' });
assert(encodedLead.project_id === 'project-1', 'lead project id should encode');
assert(encodedLead.created_month === '2026-05', 'lead created month should encode');
assert(encodedLead.contact_key === '01011112222', 'lead contact key should prefer normalized phone');
assert(encodedLead.phone_normalized === '01011112222' && encodedLead.duplicate === 1, 'lead dedupe metadata should encode');
assert(decodeD1Lead(encodedLead).answers.length === 1, 'lead answers should round-trip');
assert(decodeD1Lead(encodedLead).duplicateReason === 'phone_30d' && decodeD1Lead(encodedLead).clientId === 'client-1', 'lead dedupe metadata should round-trip');
const encodedDeliveryStatusLead = encodeD1Lead({
  ...sampleLead,
  id: 'lead-delivery-status',
  deliveryStatus: 'success',
  delivery: { status: 'failed', summary: 'failed', logs: [] },
}, { projectId: 'project-1', pageSlug: 'landing' });
assert(encodedDeliveryStatusLead.delivery_status === 'failed', 'D1 lead delivery status should prefer nested delivery status over stale top-level status');
assert(decodeD1Lead({ ...encodedDeliveryStatusLead, delivery_status: 'partial' }).delivery.status === 'partial', 'D1 decoded delivery status should follow row delivery_status');
const encodedCategoryLead = encodeD1Lead({ ...sampleLead, id: 'lead-category', type: '', kind: '', category: 'booking' }, { projectId: 'project-1', pageSlug: 'landing' });
assert(encodedCategoryLead.kind === 'booking' && decodeD1Lead(encodedCategoryLead).kind === 'booking', 'lead category should fallback into D1 kind');

const encodedEvent = encodeD1Event({
  id: 'event-1',
  type: 'page_view',
  visitorId: 'visitor-1',
  channel: 'naver',
  device: 'mobile',
  createdAt: '2026-05-10T02:00:00.000Z',
}, { projectId: 'project-1', pageSlug: 'landing' });
assert(encodedEvent.event_type === 'page_view', 'event type should encode');
assert(encodedEvent.channel === 'naver' && encodedEvent.device === 'mobile', 'event channel and device should encode');
assert(decodeD1Event(encodedEvent).visitorId === 'visitor-1', 'event visitor should round-trip');
assert(decodeD1Event(encodedEvent).channel === 'naver' && decodeD1Event(encodedEvent).device === 'mobile', 'event dimensions should round-trip');

const encodedAccount = encodeD1Account({
  email: 'User@Example.Test',
  phone: '010-3333-4444',
  name: 'User',
  passwordHash: 'hash',
  emailVerified: true,
});
assert(encodedAccount.email === 'user@example.test' && encodedAccount.phone === '01033334444', 'account email and phone should encode normalized values');
assert(decodeD1Account(encodedAccount).emailVerified, 'account email verification should decode');

const encodedInvite = encodeD1Invite({
  id: 'invite-1',
  email: 'Manager@Example.Test',
  name: 'Manager',
  token: 'invite-token',
  access: { edit: { read: true, write: true } },
}, { projectId: 'project-1', ownerId: 'owner-1' });
assert(encodedInvite.email === 'manager@example.test' && encodedInvite.project_id === 'project-1', 'invite should encode normalized email and project id');
assert(decodeD1Invite(encodedInvite).access.edit.write, 'invite access should round-trip');

const encodedMember = encodeD1ProjectMember({
  id: 'member-1',
  ownerId: 'manager-owner',
  role: 'manager',
  access: { inbox: { read: true, write: false } },
}, { projectId: 'project-1', accountId: 'manager-owner', invitedByAccountId: 'owner-1' });
assert(encodedMember.project_id === 'project-1' && encodedMember.account_id === 'manager-owner', 'project member should encode project and account ids');
assert(decodeD1ProjectMember(encodedMember).access.inbox.read, 'project member access should round-trip');
const encodedProject = encodeD1Project({
  projectId: 'project-1',
  ownerId: 'owner-1',
  slug: 'landing',
  clientEmail: 'Client@Example.TEST',
}, { projectId: 'project-1', ownerId: 'owner-1', slug: 'landing' });
assert(encodedProject.id === 'project-1' && encodedProject.client_email === 'client@example.test', 'project should encode id, owner, slug, and client email');
assert(decodeD1Project({ id: 'project-1', owner_account_id: 'owner-1', slug: 'landing' }).ownerId === 'owner-1', 'project should decode owner account id');

const encodedTransfer = encodeD1OwnershipTransferRequest({
  id: 'transfer-1',
  fromAccountId: 'owner-1',
  toAccountId: 'manager-owner',
  requestedByAccountId: 'owner-1',
  note: 'handoff after billing clears',
}, { projectId: 'project-1' });
assert(encodedTransfer.project_id === 'project-1' && encodedTransfer.status === 'requested', 'ownership transfer should encode default requested status');
assert(decodeD1OwnershipTransferRequest(encodedTransfer).billingClearanceStatus === 'not_checked', 'ownership transfer billing status should round-trip');

const encodedPage = encodeD1Page({
  slug: 'landing',
  title: 'Landing',
  blocks: [{ id: 'hero', type: 'hero' }],
  updatedAt: '2026-05-10T04:00:00.000Z',
}, { projectId: 'project-1', slug: 'landing' });
assert(encodedPage.project_id === 'project-1' && encodedPage.slug === 'landing', 'page should encode project and slug');
assert(decodeD1Page(encodedPage).blocks.length === 1, 'page JSON should round-trip');
const encodedPageWithContextId = encodeD1Page({
  id: 'stale-page-id',
  slug: 'landing-copy',
  title: 'Landing Copy',
}, { projectId: 'project-1', slug: 'landing-copy', pageId: 'current-page-id' });
assert(encodedPageWithContextId.id === 'current-page-id' && decodeD1Page(encodedPageWithContextId).id === 'current-page-id', 'page encode should trust context page id over stale page payload id');

const encodedPageRevision = encodeD1PageRevision({
  id: 'page-rev-1',
  page: decodeD1Page(encodedPage),
}, { pageId: encodedPage.id, projectId: 'project-1', revision: 1 });
assert(encodedPageRevision.page_id === encodedPage.id && decodeD1PageRevision(encodedPageRevision).page.slug === 'landing', 'page revision should encode page snapshot');

const encodedAiDraft = encodeD1AiDraft({
  id: 'draft-1',
  title: 'Draft',
  blocks: [{ id: 'hero', type: 'hero' }],
  createdAt: '2026-05-10T05:00:00.000Z',
}, { projectId: 'project-1' });
assert(encodedAiDraft.project_id === 'project-1' && decodeD1AiDraft(encodedAiDraft).blocks.length === 1, 'AI draft should encode and decode draft JSON');

const db = fakeD1();
await upsertD1Project(db, encodedProject);
await upsertD1Account(db, encodedAccount);
const accountByEmail = await getD1AccountByEmail(db, 'USER@example.test');
const accountByPhone = await getD1AccountByPhone(db, '010-3333-4444');
assert(accountByEmail?.email === 'user@example.test' && accountByPhone?.phone === '01033334444', 'account lookup should use normalized email and phone');
await upsertD1Invite(db, encodedInvite);
await upsertD1Invite(db, { ...decodeD1Invite(encodedInvite), status: 'accepted', acceptedAt: '2026-05-10T03:00:00.000Z' }, { projectId: 'project-1', ownerId: 'owner-1' });
assert(db.rows.invites.length === 1 && db.rows.invites[0].status === 'accepted', 'invite upsert should update existing D1 invite');
await upsertD1ProjectMember(db, decodeD1ProjectMember(encodedMember), { projectId: 'project-1', accountId: 'manager-owner', invitedByAccountId: 'owner-1' });
await upsertD1ProjectMember(db, { ...decodeD1ProjectMember(encodedMember), status: 'active' }, { projectId: 'project-1', accountId: 'manager-owner', invitedByAccountId: 'owner-1' });
assert(db.rows.project_members.length === 1 && db.rows.project_members[0].account_id === 'manager-owner', 'project member upsert should preserve unique project account member');
await upsertD1ProjectMember(db, { id: 'master-member', ownerId: 'owner-1', role: 'master', access: {}, status: 'active' }, { projectId: 'project-1', accountId: 'owner-1' });
await upsertD1ProjectMember(db, { id: 'client-member', ownerId: 'client-owner', role: 'client_admin', access: {}, status: 'active' }, { projectId: 'project-1', accountId: 'client-owner' });
await replaceD1ProjectMembers(db, {
  projectId: 'project-1',
  roles: ['manager'],
  members: [
    { id: 'member-1', ownerId: 'manager-owner', role: 'manager', access: { inbox: { read: true } }, status: 'active' },
    { id: 'member-2', ownerId: 'manager-disabled', role: 'manager', access: {}, status: 'removed' },
  ],
});
await replaceD1ProjectMembers(db, {
  projectId: 'project-1',
  roles: ['manager'],
  members: [
    { id: 'member-1', ownerId: 'manager-owner', role: 'manager', access: { inbox: { read: true } }, status: 'active' },
  ],
});
assert(db.rows.project_members.some((row) => row.account_id === 'manager-disabled' && row.status === 'removed'), 'project member replacement should remove omitted managers');
const d1ProjectById = await getD1ProjectById(db, 'project-1');
const d1ProjectBySlug = await getD1ProjectBySlug(db, 'landing');
const d1Members = await listD1ProjectMembers(db, { projectId: 'project-1' });
const d1Access = await getD1ProjectAccess(db, { projectId: 'project-1' });
assert(d1ProjectById?.projectId === 'project-1' && d1ProjectBySlug?.slug === 'landing', 'D1 project lookup should decode by id and slug');
assert(d1Members.length === 3 && d1Access?.ownerId === 'owner-1' && d1Access.clientOwnerIds.includes('client-owner'), 'D1 project access should derive owner/client/manager ids');
await upsertD1OwnershipTransferRequest(db, decodeD1OwnershipTransferRequest(encodedTransfer), { projectId: 'project-1' });
await upsertD1OwnershipTransferRequest(db, { ...decodeD1OwnershipTransferRequest(encodedTransfer), status: 'waiting_billing_clearance', billingClearanceStatus: 'active_subscription' }, { projectId: 'project-1' });
const transferPage = await listD1OwnershipTransferRequests(db, { projectId: 'project-1', status: 'waiting_billing_clearance', limit: 10 });
assert(db.rows.ownership_transfer_requests.length === 1 && transferPage.records[0]?.billingClearanceStatus === 'active_subscription', 'ownership transfer upsert/list should preserve billing clearance state');
await upsertD1Page(db, decodeD1Page(encodedPage), { projectId: 'project-1', slug: 'landing' });
await upsertD1Page(db, { ...decodeD1Page(encodedPage), title: 'Landing v2' }, { projectId: 'project-1', slug: 'landing' });
await upsertD1Page(db, { ...decodeD1Page(encodedPage), slug: 'landing-renamed', title: 'Landing Renamed' }, { projectId: 'project-1', slug: 'landing-renamed' });
assert(db.rows.pages.length === 1 && db.rows.pages[0].id === encodedPage.id && db.rows.pages[0].slug === 'landing-renamed', 'D1 page upsert should treat same-project page id with changed slug as an update');
await upsertD1Page(db, { ...decodeD1Page(encodedPage), title: 'Other Project Copy' }, { projectId: 'project-2', slug: 'landing-copy' });
const copiedPage = await getD1PageBySlug(db, { projectId: 'project-2', slug: 'landing-copy' });
assert(copiedPage?.id && copiedPage.id !== encodedPage.id && copiedPage.title === 'Other Project Copy', 'D1 page upsert should regenerate stale cross-project page ids');
await upsertD1Page(db, { ...copiedPage, id: 'stale-client-page-id', title: 'Other Project Copy Saved Again' }, { projectId: 'project-2', slug: 'landing-copy' });
const copiedPageSavedAgain = await getD1PageBySlug(db, { projectId: 'project-2', slug: 'landing-copy' });
assert(db.rows.pages.filter((row) => row.project_id === 'project-2' && row.slug === 'landing-copy').length === 1 && copiedPageSavedAgain?.title === 'Other Project Copy Saved Again', 'D1 page upsert should absorb duplicate project slug saves with stale page ids');
await upsertD1Page(db, { ...decodeD1Page(encodedPage), id: '', slug: 'shared-public', title: 'Older Public Slug', updatedAt: '2020-01-01T00:00:00.000Z' }, { projectId: 'project-public-old', slug: 'shared-public' });
const publicSlugWinner = await upsertD1Page(db, { ...decodeD1Page(encodedPage), id: '', slug: 'shared-public', title: 'Latest Public Slug', updatedAt: '2020-01-01T00:00:00.000Z' }, { projectId: 'project-public-new', slug: 'shared-public' });
const publicBySlug = await getD1PublicPageBySlug(db, { slug: 'shared-public' });
assert(publicBySlug?.projectId === publicSlugWinner.projectId && publicBySlug?.title === 'Latest Public Slug', 'D1 public page lookup should return the last server-saved page for a shared slug');
assert(publicSlugWinner.updatedAt && publicSlugWinner.updatedAt !== '2020-01-01T00:00:00.000Z', 'D1 page save should stamp server updatedAt instead of reusing stale client timestamps');
const pageBySlug = await getD1PageBySlug(db, { projectId: 'project-1', slug: 'landing' });
const pageRevisions = await listD1PageRevisions(db, { projectId: 'project-1', slug: 'landing' });
const oneRevision = await getD1PageRevision(db, { projectId: 'project-1', slug: 'landing', id: pageRevisions[0]?.id });
const renamedPageBySlug = await getD1PageBySlug(db, { projectId: 'project-1', slug: 'landing-renamed' });
const latestPageByProject = await getD1LatestPageByProject(db, { projectId: 'project-1' });
const renamedPageRevisions = await listD1PageRevisions(db, { projectId: 'project-1', slug: 'landing-renamed' });
const renamedRevision = renamedPageRevisions.find((revision) => revision.page?.slug === 'landing-renamed');
assert(!pageBySlug && renamedPageBySlug?.title === 'Landing Renamed' && renamedPageRevisions.length === 3 && renamedRevision, 'D1 page upsert and revisions should round-trip after slug rename');
assert(latestPageByProject?.slug === 'landing-renamed' && latestPageByProject?.title === 'Landing Renamed', 'D1 latest page lookup should recover saved delivery settings after slug mismatch');
await upsertD1AiDraft(db, decodeD1AiDraft(encodedAiDraft), { projectId: 'project-1' });
await upsertD1AiDraft(db, { ...decodeD1AiDraft(encodedAiDraft), title: 'Draft v2' }, { projectId: 'project-1' });
let aiDrafts = await listD1AiDrafts(db, { projectId: 'project-1' });
assert(aiDrafts.length === 1 && aiDrafts[0].title === 'Draft v2', 'D1 AI draft upsert/list should round-trip');
await deleteD1AiDraft(db, { projectId: 'project-1', id: 'draft-1' });
aiDrafts = await listD1AiDrafts(db, { projectId: 'project-1' });
assert(aiDrafts.length === 0 && db.rows.ai_drafts[0].status === 'deleted', 'D1 AI draft delete should soft-delete draft');
await upsertD1Lead(db, sampleLead, { projectId: 'project-1', pageSlug: 'landing' });
await upsertD1Lead(db, { ...sampleLead, status: 'checked' }, { projectId: 'project-1', pageSlug: 'landing' });
assert(db.rows.leads.length === 1 && db.rows.leads[0].status === 'checked', 'lead upsert should update existing row');

const leadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', limit: 10 });
assert(
  leadPage.records.length === 1 && leadPage.total === 1,
  `lead list should return one decoded row: ${JSON.stringify({ leadPage, rows: db.rows.leads })}`,
);
assert(leadPage.records[0].phone === '010-1111-2222', 'lead list should decode original lead');
const filteredLeadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', status: 'checked', kind: 'consult', deliveryStatus: 'pending', limit: 10 });
assert(filteredLeadPage.records.length === 1 && filteredLeadPage.total === 1, 'lead list should filter by status, kind, and delivery status');
await upsertD1Lead(db, {
  ...sampleLead,
  id: 'lead-channel-naver',
  sourceUrl: 'https://example.com/?utm_source=naver&utm_medium=cpc&utm_campaign=lead',
  createdAt: '2026-05-11T01:00:00.000Z',
}, { projectId: 'project-1', pageSlug: 'landing' });
await upsertD1Lead(db, {
  ...sampleLead,
  id: 'lead-channel-direct',
  phone: '010-3333-4444',
  sourceUrl: 'https://example.com/direct',
  createdAt: '2026-05-12T01:00:00.000Z',
}, { projectId: 'project-1', pageSlug: 'landing' });
const naverLeadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', channel: 'naver', limit: 10 });
assert(naverLeadPage.records.length === 1 && naverLeadPage.records[0].id === 'lead-channel-naver', 'lead list should filter by UTM source channel');
const directLeadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', channel: 'direct', limit: 10 });
assert(directLeadPage.records.some((lead) => lead.id === 'lead-channel-direct') && !directLeadPage.records.some((lead) => lead.id === 'lead-channel-naver'), 'lead list direct channel should exclude UTM-sourced leads');
const dateLeadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', dateFrom: '2026-05-11', dateTo: '2026-05-11', limit: 10 });
assert(dateLeadPage.records.length === 1 && dateLeadPage.records[0].id === 'lead-channel-naver', 'lead list should honor date range filters');
await deleteD1Lead(db, { projectId: 'project-1', id: 'lead-channel-naver' });
await deleteD1Lead(db, { projectId: 'project-1', id: 'lead-channel-direct' });
const searchedLeadPage = await listD1Leads(db, { projectId: 'project-1', month: '2026-05', q: 'kim', limit: 10 });
assert(searchedLeadPage.records.length === 1 && searchedLeadPage.total === 1, 'lead list should filter by search text');
const contactLeads = await findD1LeadsByContact(db, { projectId: 'project-1', month: '2026-05', phone: '01011112222' });
assert(contactLeads.length === 1 && contactLeads[0].id === 'lead-1', 'lead contact lookup should avoid monthly row hydration');
const signalLeads = await findD1LeadsByIntakeSignals(db, {
  projectId: 'project-1',
  month: '2026-05',
  pageSlug: 'landing',
  phone: '01011112222',
  clientId: 'client-1',
  ipHash: 'ip-hash-1',
});
assert(signalLeads.length === 1 && signalLeads[0].id === 'lead-1', 'lead intake signal lookup should use normalized dedupe fields');
await upsertD1Lead(db, {
  ...sampleLead,
  status: 'checked',
  delivery: {
    status: 'failed',
    summary: 'webhook failed',
    retry: { attempts: 1, maxAttempts: 3, nextRetryAt: '2026-05-10T03:00:00.000Z' },
    logs: [
      {
        target: 'Webhook',
        status: 'failed',
        message: 'timeout',
        idempotencyKey: 'lead-1:webhook',
        at: '2026-05-10T02:10:00.000Z',
      },
    ],
  },
}, { projectId: 'project-1', pageSlug: 'landing' });
const deliveryLogs = await listD1DeliveryLogs(db, { projectId: 'project-1', month: '2026-05', leadId: 'lead-1', limit: 10 });
assert(deliveryLogs.records.length === 1 && deliveryLogs.records[0].idempotencyKey === 'lead-1:webhook', 'delivery logs should persist from D1 lead delivery payload');
const deliveryQueue = await listD1DeliveryRetryQueue(db, { projectId: 'project-1', limit: 10 });
assert(deliveryQueue.retryable === 1 && deliveryQueue.entries[0]?.leadId === 'lead-1' && deliveryQueue.entries[0]?.canRetry, 'delivery retry queue should read D1 delivery logs');
const oneLead = await getD1Lead(db, { projectId: 'project-1', id: 'lead-1' });
assert(oneLead?.id === 'lead-1' && oneLead.status === 'checked', 'lead get should return decoded D1 row');
await deleteD1Lead(db, { projectId: 'project-1', id: 'lead-1' });
assert(db.rows.leads.length === 0, 'lead delete should remove D1 row');
await upsertD1Lead(db, { ...sampleLead, status: 'checked' }, { projectId: 'project-1', pageSlug: 'landing' });

const legacyLeadDb = fakeD1({ legacyLeadSchema: true });
await upsertD1Lead(legacyLeadDb, sampleLead, { projectId: 'project-legacy', pageSlug: 'landing' });
assert(legacyLeadDb.rows.leads.length === 1 && legacyLeadDb.rows.leads[0].id === 'lead-1', 'lead upsert should fallback before dedupe migration is applied');

await insertD1Event(db, { id: 'event-1', type: 'page_view', createdAt: '2026-05-10T02:00:00.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
await insertD1Event(db, { id: 'event-1', type: 'page_view', createdAt: '2026-05-10T02:00:00.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
assert(db.rows.events.length === 1, 'event insert should ignore duplicate ids');
await insertD1Event(db, { id: 'event-2', type: 'cta_click', channel: 'naver', device: 'mobile', createdAt: '2026-05-10T02:05:00.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
await insertD1Event(db, { id: 'event-2-duplicate', type: 'cta_click', dedupeKey: 'cta-same-1', channel: 'kakao', device: 'mobile', createdAt: '2026-05-10T02:05:05.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
await insertD1Event(db, { id: 'event-2-duplicate-b', type: 'cta_click', dedupeKey: 'cta-same-1', channel: 'kakao', device: 'mobile', createdAt: '2026-05-10T02:05:10.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });
await insertD1Event(db, { id: 'event-3', type: 'form_submit_success', channel: 'google', device: 'desktop', createdAt: '2026-05-11T02:05:00.000Z' }, { projectId: 'project-1', pageSlug: 'landing' });

const legacyEventDb = fakeD1({ legacyEventSchema: true });
await insertD1Event(legacyEventDb, { id: 'legacy-event-1', type: 'page_view', channel: 'naver', device: 'mobile', createdAt: '2026-05-10T02:00:00.000Z' }, { projectId: 'project-legacy', pageSlug: 'landing' });
assert(legacyEventDb.rows.events.length === 1 && legacyEventDb.rows.events[0].id === 'legacy-event-1', 'event insert should fallback before dimension migration is applied');

const eventPage = await listD1Events(db, { projectId: 'project-1', month: '2026-05', eventType: 'page_view', limit: 10 });
assert(eventPage.records.length === 1 && eventPage.records[0].type === 'page_view', 'event list should decode events');
const d1Stats = await aggregateD1Stats(db, { projectId: 'project-1', month: '2026-05' });
assert(d1Stats.totals.events === 4 && d1Stats.totals.leads === 1, 'D1 stats aggregate should count events and leads without row hydration');
assert(d1Stats.summary.pv === 1 && d1Stats.summary.cta === 2 && d1Stats.summary.submitSuccess === 1, 'D1 stats aggregate event funnel mismatch');
assert(d1Stats.summary.db === 1 && d1Stats.summary.consultLeads === 1, 'D1 stats aggregate lead funnel mismatch');
assert(d1Stats.summary.channelData.naver === 1 && d1Stats.summary.channelData.kakao === 1, 'D1 stats aggregate should dedupe channel counts');
assert(d1Stats.summary.deviceData.mobile === 2 && d1Stats.summary.deviceData.desktop === 1, 'D1 stats aggregate should include device counts');
assert(d1Stats.summary.trend.some((day) => day.id === '2026-05-10' && day.pv === 1 && day.cta === 2 && day.db === 1), 'D1 stats aggregate trend mismatch');
const d1NarrowStats = await aggregateD1Stats(db, {
  projectId: 'project-1',
  month: '2026-05',
  dateFrom: '2026-05-11T00:00:00.000Z',
  dateTo: '2026-05-11T23:59:59.999Z',
});
assert(d1NarrowStats.totals.events === 1 && d1NarrowStats.totals.leads === 0, 'D1 stats aggregate should honor date range filters');

const missingRuntime = createStorageRuntime({ INLET_STORAGE_ADAPTER: 'd1' });
const missingHealth = storageRuntimeHealth(missingRuntime);
assert(missingHealth.requested === 'd1' && missingHealth.active === 'jsonl' && missingHealth.fallback, 'missing D1 binding should fallback to jsonl');
const missingPlan = storageRuntimePlan(missingRuntime, 'leads', { month: '2026-05' });
assert(missingPlan.adapter === 'd1' && missingPlan.available === false && missingPlan.fallbackAdapter === 'jsonl', 'missing D1 plan should expose unavailable d1');

const readyRuntime = createStorageRuntime({ INLET_STORAGE_ADAPTER: 'auto', DB: db });
const readyPlan = storageRuntimePlan(readyRuntime, 'leads', { month: '2026-05' });
const readyCoverage = storageRuntimeCoverage(readyRuntime);
assert(readyRuntime.active === 'd1' && readyPlan.fullScan === false, 'ready D1 runtime should become indexed d1');
assert(readyCoverage.some((item) => item.key === 'leads' && item.adapter === 'd1'), 'ready D1 runtime should expose active lead coverage');

console.log(JSON.stringify({
  ok: true,
  checks: 57,
  accounts: db.rows.accounts.length,
  projects: db.rows.projects.length,
  invites: db.rows.invites.length,
  projectMembers: db.rows.project_members.length,
  ownershipTransfers: db.rows.ownership_transfer_requests.length,
  pages: db.rows.pages.length,
  pageRevisions: db.rows.page_revisions.length,
  aiDrafts: db.rows.ai_drafts.length,
  leads: db.rows.leads.length,
  events: db.rows.events.length,
  deliveryLogs: db.rows.delivery_logs.length,
  storageModes: ['jsonl', 'd1', 'auto'],
}, null, 2));

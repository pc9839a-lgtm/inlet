import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { copyFile, mkdir, readFile, writeFile, appendFile, readdir, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { duplicateWindowMs as duplicatePolicyWindowMs, isReservationLead as isReservationLeadPolicy, normalizeLeadContact, sameLeadKind as sameLeadKindPolicy } from '../src/lib/leadDuplicatePolicy.js';
import { buildStats as buildStatsSummary } from '../src/lib/statsMetrics.js';
import { appendJsonlRecord, queryJsonlRecords, readJsonlRecords, writeJsonlRecords } from './storage/jsonlAdapter.mjs';
import { createStorageRuntime, storageRuntimeHealth, storageRuntimePlan } from './storage/runtimeAdapter.mjs';
import { aggregateD1Stats, deleteD1AiDraft, deleteD1Lead, findD1LeadsByContact, getD1AccountByEmail, getD1AccountByPhone, getD1Lead, getD1PageBySlug, getD1PageRevision, getD1ProjectAccess, insertD1AuditLog, insertD1Event, insertD1PageRevision, listD1AiDrafts, listD1DeliveryLogs, listD1DeliveryRetryQueue, listD1Events, listD1Leads, listD1OwnershipTransferRequests, listD1PageRevisions, upsertD1Account, upsertD1AiDraft, upsertD1Invite, upsertD1Lead, upsertD1OwnershipTransferRequest, upsertD1Page, upsertD1ProjectMember } from './storage/d1Adapter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const env = loadEnv();
const port = Number(env.INLET_API_PORT || process.env.PORT || 8787);
const dataDir = path.resolve(rootDir, env.INLET_DATA_DIR || 'server/data');
const leadsFile = path.join(dataDir, 'leads.jsonl');
const usersFile = path.join(dataDir, 'users.jsonl');
const emailVerificationsFile = path.join(dataDir, 'email-verifications.jsonl');
const pagesDir = path.join(dataDir, 'pages');
const storageRuntime = createStorageRuntime(env);
const apiAuthConfig = {
  token: String(env.INLET_API_TOKEN || '').trim(),
};
const projectAuthConfig = {
  enforce: env.INLET_PROJECT_AUTH_ENFORCE !== '0',
};
const sessionAuthConfig = {
  mode: normalizeSessionAuthMode(env.INLET_SESSION_AUTH_MODE || 'dev-headers'),
  secret: String(env.INLET_SESSION_SECRET || '').trim(),
};
const sessionAuthSource = sessionAuthSourceForMode(sessionAuthConfig.mode);
const aiRuntimeConfig = {
  timeoutMs: Math.max(10000, Number(env.INLET_AI_TIMEOUT_MS || 45000)),
  fallbackModel: normalizeModel(env.INLET_AI_FALLBACK_MODEL || 'gpt-4.1-mini'),
};
const deliveryRetryConfig = {
  enabled: env.INLET_DELIVERY_AUTO_RETRY === '1',
  intervalMs: Math.max(1000, Number(env.INLET_DELIVERY_RETRY_INTERVAL_MS || 60000)),
  maxAttempts: Math.max(1, Number(env.INLET_DELIVERY_RETRY_MAX_ATTEMPTS || 3)),
};
const integrationHttpConfig = {
  timeoutMs: parseMs(env.INLET_INTEGRATION_TIMEOUT_MS, 10000, 1000),
};
const smtpConfig = {
  host: String(env.INLET_SMTP_HOST || '').trim(),
  port: Number(env.INLET_SMTP_PORT || 587),
  secure: env.INLET_SMTP_SECURE === '1',
  user: String(env.INLET_SMTP_USER || '').trim(),
  pass: String(env.INLET_SMTP_PASS || '').trim(),
  from: String(env.INLET_SMTP_FROM || env.INLET_SMTP_USER || '').trim(),
};
const eventRetentionConfig = {
  maxRecords: Math.max(1000, Number(env.INLET_EVENTS_MAX_RECORDS || 20000)),
  dedupeMs: Math.max(0, Number(env.INLET_EVENTS_DEDUPE_MS || 15000)),
};
const linkPreviewConfig = {
  timeoutMs: Math.max(1000, Number(env.INLET_LINK_PREVIEW_TIMEOUT_MS || 5000)),
  maxBytes: Math.max(4096, Number(env.INLET_LINK_PREVIEW_MAX_BYTES || 512000)),
  allowPrivate: env.INLET_LINK_PREVIEW_ALLOW_PRIVATE === '1',
};
let deliveryRetryRunning = false;
const fileLocks = new Map();

const allowedBlockTypes = [
  'hero',
  'text',
  'image',
  'map',
  'faq',
  'links',
  'timer',
  'activity',
  'spacer',
  'divider',
  'form',
  'reservation',
];

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'inlet-api',
        mode: 'local',
        auth: {
          projectEnforced: projectAuthConfig.enforce,
          sessionMode: sessionAuthConfig.mode,
          sourceOfTruth: sessionAuthSource.sourceOfTruth,
          hostedAuthImplemented: sessionAuthSource.hostedAuthImplemented,
          signedSessionReady: !!sessionAuthConfig.secret,
          devHeadersAccepted: sessionAuthConfig.mode === 'dev-headers',
        },
        storage: storageRuntimeHealth(storageRuntime),
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' });
      res.end();
      return;
    }

    const authResult = authorizeApiRequest(req, url);
    if (!authResult.ok) {
      sendJson(res, authResult.status, { ok: false, error: authResult.error });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/link-preview') {
      const preview = await fetchLinkPreview(url.searchParams.get('url') || '');
      sendJson(res, 200, { ok: true, ...preview });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await readJson(req);
      const user = await registerUserAccount(body?.user || body || {}, { source: 'signup' });
      sendJson(res, 200, { ok: true, user });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(req);
      const result = await loginUserAccount(body?.user || body || {});
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/session') {
      const body = await readJson(req);
      const result = await refreshUserSession(req, body || {});
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      sendJson(res, 200, { ok: true, loggedOut: true, mode: 'stateless-session' });
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/auth/account') {
      const body = await readJson(req);
      const result = await updateUserAccount(req, body || {});
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/email-verification') {
      const body = await readJson(req);
      const verification = await issueEmailVerification(body?.email || body?.user?.email || '', body?.purpose || 'signup');
      sendJson(res, 200, { ok: true, verification });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/email-verification/confirm') {
      const body = await readJson(req);
      const verification = await confirmEmailVerification(body || {});
      sendJson(res, 200, { ok: true, verification });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/password') {
      const body = await readJson(req);
      const user = await changeUserPassword(body || {});
      sendJson(res, 200, { ok: true, user });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/projects/invites') {
      const body = await readJson(req);
      const project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'edit' });
      await assertProjectAdmin(req, project, 'create manager invite');
      const invite = await createManagerInvite(project, body?.manager || body?.invite || {});
      sendJson(res, 200, { ok: true, invite });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/projects/ownership-transfer') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'settings' });
      await assertProjectAdmin(req, project, 'view ownership transfer requests');
      const result = await listOwnershipTransferRequests(project, {
        status: url.searchParams.get('status') || '',
        cursor: Number(url.searchParams.get('cursor') || 0),
        limit: Number(url.searchParams.get('limit') || 50),
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/projects/ownership-transfer') {
      const body = await readJson(req);
      const project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'settings' });
      await assertProjectAdmin(req, project, 'request ownership transfer');
      const request = await createOwnershipTransferRequest(req, project, body?.transfer || body?.request || {});
      sendJson(res, 200, { ok: true, request });
      return;
    }

    const adminTransferMatch = url.pathname.match(/^\/api\/admin\/ownership-transfer\/([^/]+)$/);
    if (adminTransferMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      const project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'settings' });
      await assertProjectMaster(req, project, 'approve ownership transfer');
      const request = await updateOwnershipTransferRequest(req, project, decodeURIComponent(adminTransferMatch[1]), body || {});
      sendJson(res, 200, { ok: true, request });
      return;
    }

    const inviteMatch = url.pathname.match(/^\/api\/projects\/invites\/([^/]+)$/);
    if (inviteMatch && req.method === 'GET') {
      const invite = await readManagerInvite(decodeURIComponent(inviteMatch[1]));
      if (!invite) {
        sendJson(res, 404, { ok: false, error: 'Invite not found' });
        return;
      }
      sendJson(res, 200, { ok: true, invite: publicInvite(invite) });
      return;
    }

    const inviteAcceptMatch = url.pathname.match(/^\/api\/projects\/invites\/([^/]+)\/accept$/);
    if (inviteAcceptMatch && req.method === 'POST') {
      const body = await readJson(req);
      const result = await acceptManagerInvite(decodeURIComponent(inviteAcceptMatch[1]), body || {});
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    const mapMatch = url.pathname.match(/^\/api\/maps\/([^/]+)$/);
    if (mapMatch && req.method === 'GET') {
      const map = await readMapEmbedData(decodeURIComponent(mapMatch[1]));
      if (!map) {
        sendJson(res, 404, { ok: false, error: 'Map not found' });
        return;
      }
      sendJson(res, 200, { ok: true, map });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/test') {
      const body = await readJson(req);
      await testOpenAi(body?.model, body?.apiKey);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/ai/drafts') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'edit' });
      const drafts = await listAiDrafts(project);
      sendJson(res, 200, { ok: true, drafts });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/drafts') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, bootstrap: true, tab: 'edit' });
      const draft = await saveAiDraft(body);
      sendJson(res, 200, { ok: true, draft });
      return;
    }

    const aiDraftMatch = url.pathname.match(/^\/api\/ai\/drafts\/([^/]+)$/);
    if (aiDraftMatch && req.method === 'DELETE') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { write: true, tab: 'edit' });
      const deleted = await deleteAiDraft(decodeURIComponent(aiDraftMatch[1]), project);
      sendJson(res, 200, { ok: true, ...deleted });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/draft') {
      const body = await readJson(req);
      const draft = await generateAiDraft(body?.input, body?.model, body?.apiKey);
      sendJson(res, 200, { ok: true, draft });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/leads') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, bootstrap: true, page: body?.page || {}, tab: 'inbox' });
      const saved = await saveLead(body);
      sendJson(res, 200, { ok: true, lead: saved });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/events') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, bootstrap: true, tab: 'stats' });
      const saved = await saveEvent(body);
      sendJson(res, 200, { ok: true, event: saved });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') || 1000)));
      const cursor = Math.max(0, Number(url.searchParams.get('cursor') || 0));
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'stats' });
      const result = await listEventsPage(limit, project, cursor, dateFiltersFromQuery(url));
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/stats/summary') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'stats' });
      const result = await statsSummary(project, {
        period: url.searchParams.get('period') || 'thisMonth',
        dateFrom: url.searchParams.get('dateFrom') || '',
        dateTo: url.searchParams.get('dateTo') || '',
        month: url.searchParams.get('month') || '',
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leads') {
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 100)));
      const cursor = Math.max(0, Number(url.searchParams.get('cursor') || 0));
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await listLeadsPage(limit, project, cursor, {
        kind: url.searchParams.get('kind') || '',
        status: url.searchParams.get('status') || '',
        q: url.searchParams.get('q') || '',
        month: url.searchParams.get('month') || '',
        dateFrom: url.searchParams.get('dateFrom') || '',
        dateTo: url.searchParams.get('dateTo') || '',
        deliveryStatus: url.searchParams.get('deliveryStatus') || '',
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leads/export.csv') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const exportDateFilters = normalizeDateFilters({
        month: url.searchParams.get('month') || '',
        dateFrom: url.searchParams.get('dateFrom') || '',
        dateTo: url.searchParams.get('dateTo') || '',
      });
      assertCsvDateRange(exportDateFilters);
      const ids = String(url.searchParams.get('ids') || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const csvFilters = {
        kind: url.searchParams.get('kind') || '',
        status: url.searchParams.get('status') || '',
        q: url.searchParams.get('q') || '',
        ...exportDateFilters,
        deliveryStatus: url.searchParams.get('deliveryStatus') || '',
      };
      if (storageRuntime.active === 'd1' && hasProject(project) && canUseD1LeadList(csvFilters)) {
        const d1Leads = await listD1LeadsForExport(project, csvFilters);
        const filtered = ids.length ? d1Leads.filter((lead) => ids.includes(String(lead.id || ''))) : d1Leads;
        sendCsv(res, csvFileName(project.slug || 'my-page'), leadsToCsvExport(filtered));
        return;
      }
      const csvPlan = storageQueryPlan('leads', csvFilters);
      const csvResult = await queryJsonlRecords(projectLeadsFile(project) || leadsFile, {
        type: 'csv-leads',
        filters: csvFilters,
        limit: 100000,
        cursor: 0,
        filter: (lead) => matchesLeadFilters(lead, csvFilters),
        plan: csvPlan,
      });
      const filtered = ids.length ? csvResult.records.filter((lead) => ids.includes(String(lead.id || ''))) : csvResult.records;
      sendCsv(res, csvFileName(project.slug || 'my-page'), leadsToCsvExport(filtered));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/leads/retry-failed') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'inbox' });
      const result = await retryFailedLeads(body);
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leads/retry-queue') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await listDeliveryRetryQueue(project, {
        status: url.searchParams.get('status') || '',
        month: url.searchParams.get('month') || '',
        limit: Number(url.searchParams.get('limit') || 200),
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/leads/migrate') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, bootstrap: true, tab: 'inbox' });
      const result = await migrateLeads(body?.project || {}, { dryRun: !!body?.dryRun });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leads/delivery-logs') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await listDeliveryLogs(project, {
        leadId: url.searchParams.get('leadId') || '',
        status: url.searchParams.get('status') || '',
        month: url.searchParams.get('month') || '',
        limit: Number(url.searchParams.get('limit') || 200),
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/leads/compact') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'inbox' });
      const result = await compactLeads(body?.project || {}, { dryRun: body?.dryRun !== false });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/jsonl/backups') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await listJsonlBackups(project, {
        type: url.searchParams.get('type') || 'leads',
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/jsonl/restore') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'inbox' });
      const result = await restoreJsonlBackup(body?.project || {}, {
        type: body?.type || 'leads',
        backup: body?.backup || body?.file || '',
        confirm: body?.confirm === true,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/jsonl/report') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await jsonlRepairReport(project, {
        type: url.searchParams.get('type') || 'leads',
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/jsonl/repair') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'inbox' });
      const result = await repairJsonlFile(body?.project || {}, {
        type: body?.type || 'leads',
        confirm: body?.confirm === true,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    const leadDeliverMatch = url.pathname.match(/^\/api\/leads\/([^/]+)\/deliver$/);
    if (leadDeliverMatch && req.method === 'POST') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'inbox' });
      const saved = await deliverLead(decodeURIComponent(leadDeliverMatch[1]), body);
      sendJson(res, 200, { ok: true, lead: saved, delivery: saved.delivery });
      return;
    }

    const leadMatch = url.pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (leadMatch && req.method === 'PATCH') {
      const body = await readJson(req);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'inbox' });
      const saved = await updateLead(decodeURIComponent(leadMatch[1]), body?.patch || {}, body?.project || {});
      sendJson(res, 200, { ok: true, lead: saved });
      return;
    }

    if (leadMatch && req.method === 'DELETE') {
      const body = await readJson(req);
      const project = await authorizeProjectAccess(req, hasProject(body?.project) ? body.project : projectFromQuery(url), { write: true, tab: 'inbox' });
      const deleted = await deleteLead(decodeURIComponent(leadMatch[1]), project);
      sendJson(res, 200, { ok: true, ...deleted });
      return;
    }

    const pageRevisionsMatch = url.pathname.match(/^\/api\/pages\/([a-zA-Z0-9-_]+)\/revisions$/);
    if (pageRevisionsMatch && req.method === 'GET') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'edit' });
      const revisions = await listPageRevisions(pageRevisionsMatch[1], project);
      sendJson(res, 200, { ok: true, revisions });
      return;
    }

    const pageRevisionMatch = url.pathname.match(/^\/api\/pages\/([a-zA-Z0-9-_]+)\/revisions\/([^/]+)$/);
    if (pageRevisionMatch && req.method === 'GET') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'edit' });
      const revision = await readPageRevision(pageRevisionMatch[1], decodeURIComponent(pageRevisionMatch[2]), project);
      sendJson(res, 200, { ok: true, revision, page: revision.page });
      return;
    }

    const pageRestoreMatch = url.pathname.match(/^\/api\/pages\/([a-zA-Z0-9-_]+)\/restore$/);
    if (pageRestoreMatch && req.method === 'POST') {
      const body = await readJson(req);
      const project = await authorizeProjectAccess(req, body?.project || {}, { write: true, tab: 'edit' });
      const restored = await restorePageRevision(pageRestoreMatch[1], body?.revisionId, project);
      sendJson(res, 200, { ok: true, page: restored });
      return;
    }

    const pageMatch = url.pathname.match(/^\/api\/pages\/([a-zA-Z0-9-_]+)$/);
    if (pageMatch && req.method === 'GET') {
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'edit' });
      const page = await readPage(pageMatch[1], project);
      if (!page) {
        sendJson(res, 404, { ok: false, error: 'Page not found' });
        return;
      }
      sendJson(res, 200, { ok: true, page });
      return;
    }

    if (pageMatch && req.method === 'POST') {
      const body = await readJson(req);
      const project = await authorizeProjectAccess(req, body?.project || {}, { write: true, bootstrap: true, page: body?.page || body, tab: 'edit' });
      const access = await readProjectAccess(project);
      const identity = requestIdentity(req);
      const incomingPage = body?.page || body;
      const existingPage = access && identity.ownerId !== safeId(access.ownerId, '')
        ? await readPage(pageMatch[1], project)
        : null;
      const pageToSave = existingPage
        ? { ...incomingPage, ownership: existingPage.ownership || {} }
        : incomingPage;
      const saved = await savePage(pageMatch[1], pageToSave, project, {
        expectedUpdatedAt: body?.expectedUpdatedAt || body?.page?.expectedUpdatedAt || body?.page?.__expectedUpdatedAt || '',
      });
      if (!access || identity.ownerId === safeId(access.ownerId, '')) {
        await updateProjectAccessFromPage(req, saved, project);
      }
      sendJson(res, 200, { ok: true, page: saved });
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    const status = error?.status || 500;
    sendJson(res, status, {
      ok: false,
      error: String(error?.message || error),
      ...(error?.details && typeof error.details === 'object' ? error.details : {}),
    });
  }
});

server.listen(port, () => {
  console.log(`Inlet API server listening on http://localhost:${port}`);
  runLeadMigrationOnStart();
  startDeliveryRetryWorker();
});

function loadEnv() {
  const result = {};
  for (const name of ['.env', '.env.local']) {
    const file = path.join(rootDir, name);
    if (!existsSync(file)) continue;
    const raw = readFileSyncSafe(file);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      result[key] = process.env[key] || value;
      if (!process.env[key]) process.env[key] = value;
    }
  }
  return { ...result, ...process.env };
}

function readFileSyncSafe(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function parseMs(value, fallback, minimum = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(minimum, parsed) : fallback;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Inlet-Api-Token,X-Inlet-Owner-Id,X-Inlet-Project-Id,X-Inlet-Session');
}

function authorizeApiRequest(req, url) {
  if (!apiAuthConfig.token) return { ok: true };
  if (!url.pathname.startsWith('/api/')) return { ok: true };
  if (url.pathname === '/api/health') return { ok: true };

  const headerToken = String(req.headers['x-inlet-api-token'] || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!headerToken && !bearer) return { ok: false, status: 401, error: 'Unauthorized' };
  if (headerToken === apiAuthConfig.token || bearer === apiAuthConfig.token) return { ok: true };
  return { ok: false, status: 403, error: 'Forbidden' };
}

function requestIdentity(req) {
  const session = sessionIdentity(req);
  if (session) return session;
  if (sessionAuthConfig.mode === 'strict') return { ownerId: '', projectId: '', source: 'missing-session' };
  if (sessionAuthConfig.mode === 'hosted') return { ownerId: '', projectId: '', source: 'missing-hosted-auth' };
  return {
    ownerId: safeId(req.headers['x-inlet-owner-id'] || '', ''),
    projectId: safeId(req.headers['x-inlet-project-id'] || '', ''),
    source: 'dev-header',
  };
}

function normalizeSessionAuthMode(value = '') {
  const mode = String(value || '').trim().toLowerCase();
  if (['strict', 'signed', 'production'].includes(mode)) return 'strict';
  if (['hosted', 'external'].includes(mode)) return 'hosted';
  return 'dev-headers';
}

function sessionAuthSourceForMode(mode) {
  if (mode === 'strict') {
    return { sourceOfTruth: 'signed-session', hostedAuthImplemented: false };
  }
  if (mode === 'hosted') {
    return { sourceOfTruth: 'hosted-auth-unimplemented', hostedAuthImplemented: false };
  }
  return { sourceOfTruth: 'dev-headers', hostedAuthImplemented: false };
}

function sessionIdentity(req) {
  const token = String(req.headers['x-inlet-session'] || '').trim();
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return { ownerId: '', projectId: '', source: 'invalid-session' };
  return {
    ownerId: safeId(payload.ownerId || '', ''),
    projectId: safeId(payload.projectId || '', ''),
    source: 'signed-session',
  };
}

function verifySessionToken(token = '') {
  if (!sessionAuthConfig.secret) return null;
  const [payloadPart, signaturePart] = String(token).split('.');
  if (!payloadPart || !signaturePart) return null;
  const expected = sessionSignature(payloadPart);
  if (!safeEqual(signaturePart, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function sessionSignature(payloadPart = '') {
  return createHmac('sha256', sessionAuthConfig.secret).update(payloadPart).digest('base64url');
}

function sessionTokenFromRequest(req, input = {}) {
  return String(input.session || req.headers['x-inlet-session'] || '').trim();
}

function createSessionToken(payload = {}) {
  if (!sessionAuthConfig.secret) return '';
  const payloadPart = Buffer.from(JSON.stringify({
    ...payload,
    iat: payload.iat || Math.floor(Date.now() / 1000),
    exp: payload.exp || Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30),
  })).toString('base64url');
  return `${payloadPart}.${sessionSignature(payloadPart)}`;
}

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function accessError(message, code = 'PROJECT_ACCESS_FORBIDDEN') {
  const error = new Error(message);
  error.status = 403;
  error.details = { code };
  return error;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function sendCsv(res, filename, csv) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.end(`\ufeff${csv}`);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('JSON 형식이 올바르지 않습니다.');
    error.status = 400;
    throw error;
  }
}

async function withFileLock(file, task) {
  const key = path.resolve(file);
  const previous = fileLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  const next = previous.catch(() => {}).then(() => current);
  fileLocks.set(key, next);

  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    release();
    if (fileLocks.get(key) === next) fileLocks.delete(key);
  }
}

async function fetchLinkPreview(rawUrl = '') {
  const target = normalizePreviewUrl(rawUrl);
  await assertSafePreviewUrl(target);
  const { url, text } = await fetchPreviewHtml(target);
  const meta = parsePreviewMeta(text, url);

  return {
    url,
    title: meta.title || '',
    description: meta.description || '',
    image: meta.image || '',
    site: meta.site || '',
  };
}

function normalizePreviewUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) {
    const error = new Error('url is required');
    error.status = 400;
    throw error;
  }

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    const error = new Error('invalid url');
    error.status = 400;
    throw error;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const error = new Error('unsupported url protocol');
    error.status = 400;
    throw error;
  }

  parsed.hash = '';
  return parsed.toString();
}

async function assertSafePreviewUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  if (linkPreviewConfig.allowPrivate) return;

  if (isBlockedPreviewHost(hostname)) {
    const error = new Error('private hosts are not allowed');
    error.status = 400;
    throw error;
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.some((item) => isPrivateAddress(item.address))) {
      const error = new Error('private addresses are not allowed');
      error.status = 400;
      throw error;
    }
  } catch (error) {
    if (error?.status) throw error;
    const next = new Error('host lookup failed');
    next.status = 400;
    throw next;
  }
}

function isBlockedPreviewHost(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  return (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.test')
  );
}

function isPrivateAddress(address = '') {
  const ip = net.isIP(address);
  if (!ip) return false;

  if (ip === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  const value = address.toLowerCase();
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:') ||
    value.startsWith('::ffff:127.') ||
    value.startsWith('::ffff:10.') ||
    value.startsWith('::ffff:192.168.')
  );
}

async function fetchPreviewHtml(startUrl) {
  let currentUrl = startUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertSafePreviewUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), linkPreviewConfig.timeoutMs);

    let response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'InletLinkPreview/1.0',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!response.ok) {
      const error = new Error(`preview request failed: ${response.status}`);
      error.status = response.status >= 400 && response.status < 500 ? 400 : 502;
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/text\/html|application\/xhtml\+xml|application\/xml/i.test(contentType)) {
      return { url: currentUrl, text: '' };
    }

    return { url: currentUrl, text: await readResponseTextLimited(response, linkPreviewConfig.maxBytes) };
  }

  const error = new Error('too many redirects');
  error.status = 400;
  throw error;
}

async function readResponseTextLimited(response, maxBytes) {
  if (!response.body?.getReader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    const remain = maxBytes - total;
    chunks.push(chunk.length > remain ? chunk.subarray(0, remain) : chunk);
    total += Math.min(chunk.length, remain);
    if (chunk.length > remain) break;
  }

  try {
    await reader.cancel();
  } catch {}

  return Buffer.concat(chunks).toString('utf8');
}

function parsePreviewMeta(html = '', pageUrl = '') {
  const title = pickPreviewMeta(html, [
    ['property', 'og:title'],
    ['name', 'twitter:title'],
  ]) || matchTagText(html, 'title');
  const description = pickPreviewMeta(html, [
    ['property', 'og:description'],
    ['name', 'description'],
    ['name', 'twitter:description'],
  ]);
  const image = absolutizePreviewUrl(pickPreviewMeta(html, [
    ['property', 'og:image'],
    ['name', 'twitter:image'],
    ['property', 'og:image:url'],
  ]), pageUrl);
  const site = pickPreviewMeta(html, [
    ['property', 'og:site_name'],
    ['name', 'application-name'],
  ]) || safeHostname(pageUrl);

  return {
    title: cleanPreviewText(title),
    description: cleanPreviewText(description),
    image,
    site: cleanPreviewText(site),
  };
}

function pickPreviewMeta(html = '', pairs = []) {
  for (const [attr, key] of pairs) {
    const value = matchMetaContent(html, attr, key);
    if (value) return value;
  }
  return '';
}

function matchMetaContent(html = '', attr, key) {
  const escapedKey = escapeRegExp(key);
  const attrPattern = `(?:${attr}|data-${attr})`;
  const patterns = [
    new RegExp(`<meta\\b(?=[^>]*\\b${attrPattern}=["']${escapedKey}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i'),
    new RegExp(`<meta\\b(?=[^>]*\\bcontent=["']([^"']*)["'])(?=[^>]*\\b${attrPattern}=["']${escapedKey}["'])[^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return '';
}

function matchTagText(html = '', tag = '') {
  const match = html.match(new RegExp(`<${escapeRegExp(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegExp(tag)}>`, 'i'));
  return match?.[1] ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' ')) : '';
}

function absolutizePreviewUrl(value = '', baseUrl = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const next = new URL(raw, baseUrl);
    if (!['http:', 'https:'].includes(next.protocol)) return '';
    return next.toString();
  } catch {
    return '';
  }
}

function safeHostname(url = '') {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function cleanPreviewText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireOpenAiKey(requestKey = '') {
  const key = String(requestKey || process.env.OPENAI_API_KEY || '').trim();
  if (!key) {
    const error = new Error('OpenAI API 키가 필요합니다. 고객 API 키를 입력하거나 서버 환경변수 OPENAI_API_KEY를 설정하세요.');
    error.status = 500;
    throw error;
  }
  if (!key.startsWith('sk-') || key.length < 20) {
    const error = new Error('OpenAI API 키 형식이 올바르지 않습니다.');
    error.status = 400;
    throw error;
  }
  return key;
}

async function testOpenAi(model = 'gpt-4.1', requestKey = '') {
  const key = requireOpenAiKey(requestKey);
  const data = await callOpenAi({
    key,
    model: normalizeModel(model),
    input: '정상 연결 확인용입니다. OK만 출력하세요.',
    max_output_tokens: 16,
  });
  return data;
}

async function generateAiDraft(input = {}, model = 'gpt-4.1', requestKey = '') {
  const normalized = normalizeAiDraftInput(input);
  validateRequiredInput(normalized);
  const prompt = buildAiDraftPrompt(normalized);
  const key = requireOpenAiKey(requestKey);
  const requestedModel = normalizeModel(model);
  const completion = await callOpenAiWithFallback({
    key,
    model: requestedModel,
    input: prompt,
    temperature: 0.78,
    max_output_tokens: 3200,
  });
  const draft = finalizeAiDraftResponse(extractJson(getResponseText(completion.data)), normalized);
  validateDraft(draft);
  const repaired = await repairDraftIfWeak({ key, model: completion.model, basePrompt: prompt, draft, input: normalized });
  return {
    ...repaired,
    generationMeta: {
      model: completion.model,
      requestedModel,
      fallbackUsed: completion.fallbackUsed,
      fallbackReason: completion.fallbackReason || '',
    },
  };
}

function draftTextBlob(draft = {}) {
  return JSON.stringify({
    pageTitle: draft.pageTitle,
    brandName: draft.brandName,
    qualityNote: draft.qualityNote,
    primaryAction: draft.primaryAction,
    blocks: draft.blocks,
  });
}

function keywordTokens(input = {}) {
  return [input.prompt, input.industry, input.serviceName, input.benefit, input.targetCustomer, input.keyMessage]
    .join(' ')
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 12);
}

function draftQualityIssues(draft = {}, input = {}) {
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  const text = draftTextBlob(draft);
  const compact = text.replace(/\s+/g, '');
  const issues = [];
  const genericPhrases = ['제목과내용만', '쉽고예쁘게', '고객맞춤', '빠른문의', '문의해주세요', '정보를남겨주시면', '확인후연락', '맞춤형서비스', '최상의서비스', '전문적인상담'];
  const genericHits = genericPhrases.filter((phrase) => compact.includes(phrase));
  const tokens = keywordTokens(input);
  const tokenHits = tokens.filter((token) => text.includes(token)).length;
  const hero = blocks.find((block) => block.type === 'hero');
  const heroText = `${hero?.title || ''} ${hero?.body || ''}`;
  const textBodies = blocks
    .filter((block) => block.type === 'text')
    .map((block) => String(block.body || '').replace(/\s+/g, ''))
    .filter(Boolean);
  const form = blocks.find((block) => block.type === 'form');
  const questions = Array.isArray(form?.questions) ? form.questions : [];
  const meaningfulQuestions = questions.filter((question) => !['name', 'phone', 'email'].includes(question?.type));
  const weakQuestionLabels = meaningfulQuestions.filter((question) => /문의|내용|기타|요청/i.test(String(question.label || ''))).length;
  const requestedSections = Array.isArray(input.sections) ? input.sections : [];
  const ctaLabels = [
    draft.primaryAction?.label,
    ...blocks.flatMap((block) => [
      block.ctaText,
      block.submit,
      block.ctaLabel,
      ...(Array.isArray(block.items) ? block.items.map((item) => item.label) : []),
    ]),
  ].filter(Boolean);
  const uniqueCtas = new Set(ctaLabels.map((label) => String(label).replace(/\s+/g, ''))).size;

  if (text.length < 420) issues.push('전체 카피 정보량이 부족합니다.');
  if (genericHits.length) issues.push(`복붙형 일반 문구가 남아 있습니다: ${genericHits.slice(0, 3).join(', ')}`);
  if (tokens.length >= 2 && tokenHits < Math.min(2, tokens.length)) issues.push('사용자 입력 키워드가 충분히 반영되지 않았습니다.');
  if (tokens.length >= 2 && tokens.filter((token) => heroText.includes(token)).length < 1) issues.push('히어로에 사용자의 핵심 키워드가 보이지 않습니다.');
  if (textBodies.length >= 2 && new Set(textBodies).size < textBodies.length) issues.push('텍스트 블록 내용이 반복됩니다.');
  if (form && questions.length < 3) issues.push('상담폼 질문이 너무 얕습니다.');
  if (form && meaningfulQuestions.length < 2 && !requestedSections.includes('reservation')) issues.push('폼에 업종 판단 질문이 부족합니다.');
  if (form && meaningfulQuestions.length && weakQuestionLabels >= meaningfulQuestions.length) issues.push('폼 질문 라벨이 너무 일반적입니다.');
  if (requestedSections.includes('reservation') && !blocks.some((block) => block.type === 'reservation')) issues.push('방문예약 목적에 예약 블록이 없습니다.');
  if (requestedSections.includes('timer') && !blocks.some((block) => block.type === 'timer')) issues.push('이벤트/마감 목적에 타이머 블록이 없습니다.');
  if (ctaLabels.length >= 2 && uniqueCtas < 2) issues.push('CTA/버튼 문구가 행동별로 구분되지 않습니다.');

  return issues.slice(0, 5);
}

function buildQualityRepairPrompt(basePrompt, draft, issues, input) {
  return `
아래 초안은 품질 검사에서 탈락했다. 같은 JSON 스키마를 유지하되 더 깊고 구체적인 전환형 랜딩페이지 초안으로 전면 재작성하라.

[탈락 사유]
${issues.map((issue) => `- ${issue}`).join('\n')}

[보강 지시]
- 업종/서비스/타깃/혜택 키워드를 카피에 자연스럽게 더 넣는다.
- 각 text 블록은 서로 다른 역할을 맡긴다: 문제 공감, 선택 기준, 진행 흐름, 안심 근거 중 하나.
- body는 최소 35자 이상, 모바일에서 읽히는 1~2문장으로 쓴다.
- 폼 질문은 이름/연락처 외에 업종별 판단에 필요한 항목을 1~3개 추가한다.
- 질문 라벨은 "문의내용" 같은 일반어보다 희망 일정, 현재 상황, 관심 항목, 예산/규모처럼 판단 가능한 항목으로 쓴다.
- 버튼 문구는 상담/예약/전화/확인 등 행동이 구분되게 쓴다.
- 요청 섹션에 reservation/timer가 있으면 해당 블록을 우선 포함한다.
- 일반 템플릿 문구를 제거하고 실제 ${input.industry || '서비스'} 랜딩처럼 보이게 만든다.

[원래 요청]
${basePrompt}

[탈락 초안]
${JSON.stringify(draft)}
`.trim();
}

async function repairDraftIfWeak({ key, model, basePrompt, draft, input }) {
  const issues = draftQualityIssues(draft, input);
  if (!issues.length) return { ...draft, qualityWarnings: [] };

  try {
    const repairData = await callOpenAi({
      key,
      model,
      input: buildQualityRepairPrompt(basePrompt, draft, issues, input),
      temperature: 0.72,
      max_output_tokens: 3600,
    });
    const repaired = finalizeAiDraftResponse(extractJson(getResponseText(repairData)), input);
    validateDraft(repaired);
    const repairedIssues = draftQualityIssues(repaired, input);
    return repairedIssues.length <= Math.max(0, issues.length - 1)
      ? { ...repaired, qualityWarnings: repairedIssues }
      : { ...draft, qualityWarnings: issues };
  } catch (err) {
    console.warn('AI draft quality repair failed:', err);
    return { ...draft, qualityWarnings: issues };
  }
}

function isTransientAiError(error) {
  const message = String(error?.message || '');
  return error?.status === 504
    || /서버 오류|요청 시간이 초과|잠시 후 다시/i.test(message);
}

async function callOpenAiWithFallback(args) {
  try {
    const data = await callOpenAi(args);
    return { data, model: args.model, fallbackUsed: false };
  } catch (error) {
    const fallbackModel = aiRuntimeConfig.fallbackModel;
    if (!isTransientAiError(error) || fallbackModel === args.model) throw error;
    console.warn(`AI request failed on ${args.model}; retrying with ${fallbackModel}:`, error?.message || error);
    const data = await callOpenAi({ ...args, model: fallbackModel });
    return { data, model: fallbackModel, fallbackUsed: true, fallbackReason: String(error?.message || error).slice(0, 180) };
  }
}

async function callOpenAi({ key, model, input, temperature, max_output_tokens }) {
  if (typeof fetch !== 'function') {
    throw new Error('Node 18 이상이 필요합니다. fetch API를 사용할 수 없습니다.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiRuntimeConfig.timeoutMs);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input,
        ...(temperature == null ? {} : { temperature }),
        max_output_tokens,
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI 요청 시간이 초과되었습니다. ${Math.round(aiRuntimeConfig.timeoutMs / 1000)}초 안에 응답하지 않았습니다.`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let message = raw || '';
    try {
      const json = JSON.parse(raw);
      message = json?.error?.message || message;
    } catch {}
    const error = new Error(formatOpenAiError(message, res.status));
    error.status = 502;
    throw error;
  }

  return res.json();
}

function formatOpenAiError(message = '', status = 0) {
  const text = String(message || '').trim();
  const requestId = text.match(/request id\s+([A-Za-z0-9_-]+)/i)?.[1];
  const suffix = requestId ? ` 요청 ID: ${requestId}` : '';

  if (/processing your request|help\.openai\.com/i.test(text)) {
    return `OpenAI 서버가 요청 처리에 실패했습니다. 잠시 후 다시 시도하거나 모델을 바꿔보세요.${suffix}`;
  }

  if (status === 401 || /incorrect api key|invalid api key|authentication/i.test(text)) {
    return 'OpenAI API 키 인증에 실패했습니다. 서버 환경변수 OPENAI_API_KEY를 확인해주세요.';
  }

  if (status === 429 || /rate limit|quota|billing/i.test(text)) {
    return 'OpenAI 사용량 한도 또는 결제 설정 문제로 요청이 막혔습니다. OpenAI 계정의 결제/한도를 확인해주세요.';
  }

  if (status >= 500) {
    return `OpenAI 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.${suffix}`;
  }

  return text || `OpenAI 요청 실패: ${status}`;
}

function normalizeModel(model) {
  const safe = String(model || 'gpt-4.1').trim();
  return ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1-nano'].includes(safe) ? safe : 'gpt-4.1';
}

function normalizeAiDraftInput(input = {}) {
  const sectionKeys = ['hero', 'benefit', 'links', 'map', 'timer', 'activity', 'form', 'reservation', 'faq'];
  const templateKeys = ['auto', 'trust', 'promo', 'booking', 'story', 'compare'];
  const sections = Array.isArray(input.sections) && input.sections.length
    ? input.sections.filter((key) => sectionKeys.includes(key))
    : ['hero', 'benefit', 'links', 'form'];

  return {
    inputMode: ['simple', 'detail'].includes(input.inputMode) ? input.inputMode : 'simple',
    prompt: String(input.prompt || '').trim(),
    industry: String(input.industry || '').trim(),
    serviceName: String(input.serviceName || '').trim(),
    goal: String(input.goal || '상담신청').trim(),
    benefit: String(input.benefit || '').trim(),
    cta: String(input.cta || '상담 신청하기').trim(),
    contactMethod: String(input.contactMethod || '상담폼').trim(),
    targetCustomer: String(input.targetCustomer || '').trim(),
    tone: String(input.tone || 'premium').trim(),
    templateStyle: templateKeys.includes(input.templateStyle) ? input.templateStyle : 'auto',
    creativeSeed: String(input.creativeSeed || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`).trim(),
    keyMessage: String(input.keyMessage || '').trim(),
    avoidWords: String(input.avoidWords || '').trim(),
    templateMeta: input.templateMeta && typeof input.templateMeta === 'object' ? input.templateMeta : null,
    sections: sections.length ? sections : ['hero', 'benefit', 'links', 'form'],
  };
}

function validateRequiredInput(input) {
  if (!String(input.prompt || '').trim() && !String(input.industry || '').trim()) {
    const error = new Error('자유 입력 또는 업종/키워드 입력이 필요합니다.');
    error.status = 400;
    throw error;
  }
}

function aiTemplateGuide(style = 'auto') {
  const guides = {
    auto: 'creativeSeed를 기준으로 아래 5가지 템플릿 중 하나를 선택한다. 같은 입력이라도 매번 다른 구조/문장/블록 순서를 만든다.',
    trust: '신뢰형: 문제 공감 -> 전문성/검증 포인트 -> 핵심 혜택 -> 문의 유도. 차분하고 근거 중심으로 구성한다.',
    promo: '프로모션형: 강한 첫 문장 -> 혜택/마감/한정성 -> 빠른 CTA -> 폼. 단, 허위 보장과 과장 표현은 금지한다.',
    booking: '예약전환형: 일정 선택 장점 -> 상담/방문 흐름 -> 예약 CTA -> reservation 중심으로 구성한다.',
    story: '스토리형: 고객 상황 -> 해결 장면 -> 선택 이유 -> 행동 유도. 문장은 감각적이되 짧게 쓴다.',
    compare: '비교설득형: 기존 방식의 불편 -> 이 서비스의 차이 -> 선택 기준 -> 문의 CTA. 비교는 명확하되 비방은 금지한다.',
  };
  return guides[style] || guides.auto;
}

function buildAiDraftPrompt(input) {
  const allowed = allowedBlockTypes.join(', ');
  const selectedTemplate = input.templateStyle || 'auto';
  return `
너는 전환율 높은 모바일 랜딩페이지를 만드는 한국어 카피라이터, UX 설계자, 퍼포먼스 마케터다.

사용자가 입력한 정보를 바탕으로 앱에서 바로 편집 가능한 랜딩페이지 블록 JSON만 생성한다.
단순히 블록을 배치하지 말고, 고객의 불안/욕구/전환 장벽을 추론해 카피, CTA, 폼 질문, 메뉴, 하단 버튼, 시각 톤까지 한 번에 설계한다.

[중요 규칙]
- HTML, CSS, JavaScript를 절대 출력하지 않는다.
- 설명 문장, 마크다운, 코드블록 없이 JSON만 출력한다.
- 앱에서 지원하는 블록 타입만 사용한다: ${allowed}
- benefit은 블록 타입으로 절대 쓰지 않는다. 혜택은 반드시 type:"text"로 만든다.
- topnav, bottombar, footer는 생성하지 않는다.
- 모바일 화면 기준으로 짧고 명확한 문구를 작성한다.
- 짧은 입력이어도 업종 관행, 고객 불안, 구매/문의 동기를 추론해 빈약하지 않게 구성한다.
- 사용자가 나중에 수동 편집하기 쉬운 단순한 구조로 만들되, 모든 초안이 같은 흐름이 되지 않게 한다.
- 과장 광고, 허위 보장, 지나친 자극 문구는 피한다.
- CTA는 핵심 행동 1개 중심으로 구성한다.
- pageTitle, brandName, primaryAction은 업종/서비스에 맞게 구체적으로 작성한다.
- 상담폼 질문은 꼭 필요한 항목만 만든다.
- form을 만들 경우 이름/연락처는 필수로 포함한다.
- form 질문에는 placeholder와 선택형 options를 넣어 사용자가 바로 수정 가능한 상태로 만든다.
- links를 만들 경우 contactMethod에 맞춰 form/reservation/phone/url 중 하나로 연결한다.
- links 아이템은 같은 라벨을 반복하지 말고 상담/예약/전화/카카오 등 행동 차이를 분명히 쓴다.
- 전화번호가 입력에 없으면 target:"phone" 링크를 만들지 않는다. 임의 전화번호를 만들지 않는다.
- 외부 URL이 입력에 없으면 target:"url" 링크를 만들지 않는다. 임의 URL을 만들지 않는다.
- 실제 이미지 URL이나 이미지 데이터가 없으면 type:"image" 블록을 만들지 않는다.
- timer를 넣는 경우 문구는 업종 혜택과 연결된 마감/잔여 상담/예약 기준으로 작성한다.
- 전체 블록은 5~8개 정도로 구성한다.
- 각 title은 18자 내외, body는 모바일에서 읽기 쉽게 1~2문장으로 작성한다.
- "혜택" 섹션은 반드시 text 블록으로 생성한다. type:"benefit" 금지.
- FAQ가 필요하면 type:"faq" 위젯으로 만든다.
- 위치/방문이 중요한 서비스면 type:"map" 위젯을 포함할 수 있다. 지도는 중앙 Google Embed 래퍼 기반이며 placeName/address/detailAddress/phone/parkingText/mapMode만 넣는다.
- 한 줄짜리 뻔한 문구를 반복하지 말고, 업종별 구체 단어를 최소 4개 이상 사용한다.
- "최고", "무조건", "100%", "보장" 같은 검증 불가 표현은 피한다.
- "제목과 내용만", "쉽고 예쁘게", "고객 맞춤", "빠른 문의", "문의해주세요"처럼 업종이 바뀌어도 그대로 쓸 수 있는 문구는 실패로 간주한다.
- 각 블록은 서로 다른 역할을 가져야 한다. 같은 의미의 상담 유도 문장을 반복하지 않는다.
- 단순 소개가 아니라 전환 설계여야 한다. 고객이 망설이는 이유, 선택 기준, 다음 행동을 반드시 연결한다.

[짧은 입력 보강]
- serviceName이 비어 있으면 업종명에서 자연스러운 임시 서비스명을 만든다.
- benefit이 비어 있으면 업종별 대표 혜택 2~3개를 추론해 body에 녹인다.
- targetCustomer가 비어 있으면 가장 가능성 높은 고객군을 가정하되 과하게 좁히지 않는다.
- keyMessage가 비어 있어도 hero/title은 구체적으로 작성한다.
- 지역, 가격, 일정, 대상, 절차 정보가 비어 있으면 허위 숫자를 만들지 말고 "상담 시 확인"처럼 안전하게 표현한다.

[깊이 기준]
- hero는 "누구에게 / 무엇을 / 왜 지금"이 드러나야 한다.
- 첫 text는 고객의 문제 또는 선택 기준을 짚는다.
- 두 번째 text는 서비스의 차별점/진행 흐름/혜택을 구체화한다.
- links는 실제 행동 버튼 역할을 해야 한다.
- form/reservation은 업종별로 필요한 질문 3~5개를 포함하되 과하게 묻지 않는다.
- theme는 카피 톤과 어울리는 색/배경/버튼 효과를 제안한다.

[전환 설계 체크리스트]
출력 전 스스로 아래 항목을 검토하고 JSON에 반영한다.
- 첫 화면만 봐도 어떤 서비스인지 알 수 있는가?
- 고객이 왜 지금 남겨야 하는지 이유가 있는가?
- 상담/예약 전에 필요한 정보만 묻는가?
- 업종/서비스명/혜택/타깃 중 최소 3개가 카피에 녹아 있는가?
- 버튼 문구가 모두 같은 말이 아니라 행동별로 구분되는가?
- 복붙 느낌의 빈 문구가 없는가?

[출력 전 자체 검수 프로세스]
최종 JSON을 출력하기 전에 내부적으로 반드시 아래 순서를 수행한다. 이 과정은 출력하지 않는다.
1. 초안을 만든다.
2. 아래 탈락 조건 중 하나라도 있으면 초안을 폐기하고 다시 쓴다.
3. 통과한 최종 JSON만 출력한다.

탈락 조건:
- hero에 업종/서비스/대상 중 2개 이상이 드러나지 않는다.
- text body가 어떤 업종에도 쓸 수 있는 일반 문장이다.
- 사용자 입력 키워드가 전체 카피에 거의 보이지 않는다.
- links/form/reservation의 행동 목적이 서로 구분되지 않는다.
- 폼 질문이 이름/연락처만 있고 업종별 판단 질문이 없다.
- theme가 기본 검정/흰색 수준으로만 끝난다.
- qualityNote가 "구성했습니다", "반영했습니다" 같은 설명뿐이고 전략이 없다.

[카피 작성 방식]
- 짧게 쓰되 정보량을 높인다.
- 추상어보다 구체 명사를 우선한다.
- 가격/성과/기간을 지어내지 않는다.
- 불확실한 정보는 "상담 시 확인", "현재 조건 기준 안내"처럼 안전하게 쓴다.
- 모바일에서 읽히도록 문장은 짧게 나누되, body는 최소 35자 이상 작성한다.

[템플릿 다양화]
선택 템플릿: ${selectedTemplate}
템플릿 가이드: ${aiTemplateGuide(selectedTemplate)}
creativeSeed: ${input.creativeSeed || 'none'}

가능한 템플릿 패턴:
- trust: hero -> text(문제/신뢰) -> text(혜택) -> activity -> form
- promo: hero -> timer -> text(혜택) -> links -> form
- booking: hero -> text(방문 흐름) -> reservation -> links -> faq
- story: hero -> text(고객 상황) -> text(해결) -> activity -> form
- compare: hero -> text(비교 기준) -> text(선택 이유) -> links -> form
auto인 경우 creativeSeed를 참고해 위 패턴 중 하나를 고르고, block 순서/layout/title 표현을 매번 다르게 만든다.

[사용자 입력]
자유 요청: ${input.prompt || '없음'}
업종: ${input.industry}
서비스명/상품명: ${input.serviceName || '입력 없음 - 업종 기반으로 추론'}
랜딩 목적: ${input.goal}
핵심 혜택: ${input.benefit || '입력 없음 - 업종 기반으로 추론'}
CTA 문구: ${input.cta}
연락 방식: ${input.contactMethod}
타깃 고객: ${input.targetCustomer || '입력 없음 - 업종 기반으로 추론'}
톤: ${input.tone || 'premium'}
템플릿: ${selectedTemplate}
강조 문구: ${input.keyMessage || '없음'}
제외 표현: ${input.avoidWords || '없음'}
포함 섹션: ${(input.sections || []).join(', ')}
추천 메타: ${JSON.stringify(input.templateMeta || null)}

[입력 반영 우선순위]
1. 자유 요청에 적힌 업종, 고객, 혜택, 금지사항을 가장 우선한다.
2. 상세 입력값은 자유 요청을 보완하는 기준으로 사용한다.
3. 추천 메타와 템플릿은 구조 참고용이며, 사용자가 고른 목적/연락/섹션을 덮어쓰지 않는다.
4. 입력에 없는 가격, 기간, 수치, 성과, 보장 문구는 새로 만들지 않는다.
5. 포함 섹션에 없는 블록은 꼭 필요한 경우에만 1개 이하로 추가한다.

[출력 JSON 스키마]
{
  "pageTitle": "문자열",
  "brandName": "짧은 브랜드/서비스명",
  "templateStyle": "trust|promo|booking|story|compare",
  "qualityNote": "구성 의도 한 문장",
  "primaryAction": {
    "label": "대표 CTA",
    "target": "form|reservation|phone|url",
    "url": ""
  },
  "theme": {
    "tone": "simple|premium|friendly|professional|strong_cta",
    "accentColor": "#111827",
    "bgMode": "solid|gradient",
    "bgColor": "#F5F7FA",
    "gradientFrom": "#F5F7FA",
    "gradientTo": "#EAF2FF",
    "cardColor": "#FFFFFF",
    "textColor": "#111827",
    "radius": 24,
    "buttonEffect": "fill|shine|burst",
    "animation": "fade|rise|scale"
  },
  "blocks": [
    { "type": "hero", "title": "문자열", "body": "문자열", "ctaText": "문자열", "align": "left|center", "height": "medium|large", "titleSize": "medium|large" },
    { "type": "text", "title": "문자열", "body": "문자열", "layout": "plain|card|notice", "align": "left|center", "size": "medium|large" },
    {
      "type": "links",
      "title": "문자열",
      "layout": "list|card|carousel",
      "items": [{ "label": "문자열", "target": "form|reservation|phone|url", "url": "", "emoji": "문자 1개 또는 빈 문자열", "iconMode": "emoji|none" }]
    },
    { "type": "image", "image": "실제 이미지 URL 또는 data URI", "caption": "문자열" },
    { "type": "map", "placeName": "장소명", "address": "문자열", "detailAddress": "문자열", "phone": "문자열", "parkingText": "문자열", "mapMode": "google_embed" },
    { "type": "timer", "label": "마감까지 남은 시간", "repeatMode": "daily24|fixed", "timerTheme": "modern|glass|minimal|accent", "urgentStyle": "flip|line|flow|none", "ctaLabel": "문자열" },
    { "type": "activity", "title": "실시간 접수현황", "mode": "feed|count", "sampleKind": "consult|reservation|both", "style": "minimal|glass|dark" },
    {
      "type": "form",
      "title": "문자열",
      "desc": "문자열",
      "submit": "문자열",
      "style": "card|line|soft|minimal",
      "inputStyle": "round|box|underline",
      "buttonStyle": "solid|round|line",
      "buttonHover": "fill|slide|zoom",
      "questions": [{ "label": "이름", "type": "name|short|phone|email|long|select|multi|address", "required": true, "placeholder": "문자열", "options": ["선택지"] }]
    },
    { "type": "faq", "title": "자주 묻는 질문", "layout": "accordion|card|plain", "items": [{ "q": "질문", "a": "답변" }] },
    { "type": "reservation", "title": "문자열", "desc": "문자열", "weekdays": ["mon","tue","wed","thu","fri"], "start": "10:00", "end": "18:00", "interval": 30, "customFields": [{ "label": "추가 확인 항목", "type": "short|long|select", "required": false, "options": ["선택지"] }] }
  ]
}
`.trim();
}

function getResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('');
}

function extractJson(text = '') {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('AI 응답이 비어 있습니다.');
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last < first) throw new Error('JSON을 찾지 못했습니다.');
  return JSON.parse(cleaned.slice(first, last + 1));
}

function normalizeAiDraftResponse(json) {
  if (!json || !Array.isArray(json.blocks)) return json;
  return {
    ...json,
    blocks: json.blocks.map((block) => {
      if (block?.type === 'benefit') {
        return { ...block, type: 'text', title: block.title || '혜택', body: block.body || block.desc || '' };
      }
      return block;
    }),
  };
}

function fallbackAiTemplateStyle(input = {}) {
  const styles = ['trust', 'promo', 'booking', 'story', 'compare'];
  if (styles.includes(input.templateStyle)) return input.templateStyle;
  const seed = String(input.creativeSeed || input.industry || 'seed');
  const sum = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return styles[sum % styles.length];
}

function finalizeAiDraftResponse(json, input = {}) {
  const normalized = normalizeAiDraftResponse(json);
  if (!normalized || typeof normalized !== 'object') return normalized;
  return {
    ...normalized,
    templateStyle: ['trust', 'promo', 'booking', 'story', 'compare'].includes(normalized.templateStyle)
      ? normalized.templateStyle
      : fallbackAiTemplateStyle(input),
  };
}

function validateDraft(draft) {
  if (!draft || typeof draft !== 'object') {
    const error = new Error('JSON 객체가 아닙니다.');
    error.status = 502;
    throw error;
  }
  if (!Array.isArray(draft.blocks)) {
    const error = new Error('blocks 배열이 없습니다.');
    error.status = 502;
    throw error;
  }
  if (draft.blocks.length < 4 || draft.blocks.length > 12) {
    const error = new Error('AI 초안 블록 수가 올바르지 않습니다.');
    error.status = 502;
    throw error;
  }
  const invalid = draft.blocks.find((block) => !allowedBlockTypes.includes(block?.type));
  if (invalid) {
    const error = new Error(`지원하지 않는 블록 타입입니다: ${invalid?.type || 'unknown'}`);
    error.status = 502;
    throw error;
  }
  const emptyImage = draft.blocks.find((block) => block?.type === 'image' && !block.image && !block.url && !block.src && !(Array.isArray(block.gallery) && block.gallery.length));
  if (emptyImage) {
    const error = new Error('이미지 블록에는 실제 이미지가 필요합니다. 이미지를 쓰지 않거나 실제 이미지 URL을 넣어 다시 생성해주세요.');
    error.status = 502;
    throw error;
  }
  const badLink = draft.blocks.find((block) => block?.type === 'links' && Array.isArray(block.items) && block.items.some((item) => {
    if (item?.target === 'phone') return !/^tel:\d[\d-]+$/i.test(String(item.url || '').trim());
    if (item?.target === 'url') return !/^https?:\/\//i.test(String(item.url || '').trim());
    return false;
  }));
  if (badLink) {
    const error = new Error('전화 또는 외부 링크는 실제 연결 주소가 필요합니다. 전화번호/URL을 입력하거나 해당 링크를 제외해주세요.');
    error.status = 502;
    throw error;
  }
  const form = draft.blocks.find((block) => block?.type === 'form');
  if (form && Array.isArray(form.questions)) {
    const meaningful = form.questions.filter((question) => !['name', 'phone', 'email'].includes(question?.type)).length;
    if (form.questions.length < 3 || meaningful < 1) {
      const error = new Error('상담 폼에는 업종에 맞는 추가 질문이 필요합니다. 이름/연락처 외에 상담 내용, 희망 일정, 관심 항목 중 하나 이상을 넣어주세요.');
      error.status = 502;
      throw error;
    }
  }
}

async function listAiDrafts(project = {}) {
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    return listD1AiDrafts(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      limit: 20,
    });
  }
  return readAiDraftList(project);
}

async function saveAiDraft(body = {}) {
  const item = body.draft;
  if (!item || typeof item !== 'object') {
    const error = new Error('draft 객체가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const project = hasProject(body.project) ? normalizeProject(body.project) : {};
  const saved = {
    ...item,
    id: item.id || randomId(),
    createdAt: item.createdAt || new Date().toISOString(),
    savedAt: new Date().toISOString(),
  };
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    return upsertD1AiDraft(storageRuntime.d1, saved, {
      projectId: project.projectId,
      createdByAccountId: body.createdByAccountId || body.authUser?.ownerId || '',
    });
  }
  const targetFile = aiDraftsFile(project);
  return withFileLock(targetFile, async () => {
    const current = await readAiDraftList(project);
    const next = [saved, ...current.filter((draft) => draft.id !== saved.id)].slice(0, 20);
    await writeAiDraftList(next, project);
    return saved;
  });
}

async function deleteAiDraft(id, project = {}) {
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    return deleteD1AiDraft(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      id,
    });
  }
  const targetFile = aiDraftsFile(project);
  return withFileLock(targetFile, async () => {
    const current = await readAiDraftList(project);
    const next = current.filter((draft) => String(draft.id) !== String(id));
    await writeAiDraftList(next, project);
    return { id };
  });
}

async function readAiDraftList(project = {}) {
  try {
    const raw = await readFile(aiDraftsFile(project), 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeAiDraftList(drafts, project = {}) {
  const targetFile = aiDraftsFile(project);
  await mkdir(path.dirname(targetFile), { recursive: true });
  await writeFile(targetFile, JSON.stringify(drafts, null, 2), 'utf8');
}

async function saveLead(body = {}) {
  const lead = body.lead || body;
  if (!lead || typeof lead !== 'object') {
    const error = new Error('lead 객체가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const project = hasProject(body.project) ? normalizeProject(body.project) : {};
  const normalizedLead = normalizeServerLead(lead);
  const saved = {
    ...normalizedLead,
    savedAt: new Date().toISOString(),
    page: body.page || normalizedLead.page || null,
    ...(hasProject(project) ? { project } : {}),
  };

  if (storageRuntime.active === 'd1' && hasProject(project)) {
    const duplicate = await findD1DuplicateLead(normalizedLead, project);
    if (duplicate && String(duplicate.id || '') !== String(normalizedLead.id || '')) {
      const error = new Error('이미 접수된 연락처입니다.');
      error.status = 409;
      throw error;
    }
    const savedD1 = await upsertD1Lead(storageRuntime.d1, saved, {
      projectId: project.projectId,
      pageSlug: project.slug || body.page?.slug || '',
    });
    return { ...saved, ...savedD1, storageAdapter: 'd1' };
  }

  const targetFile = projectLeadsFile(project) || leadsFile;
  await mkdir(path.dirname(targetFile), { recursive: true });

  return withFileLock(targetFile, async () => {
    const duplicate = await findDuplicateLead(normalizedLead, project);
    if (duplicate && String(duplicate.id || '') !== String(normalizedLead.id || '')) {
      const error = new Error('이미 접수된 연락처입니다.');
      error.status = 409;
      throw error;
    }

    const leads = await readLeadList(project);
    const index = leads.findIndex((item) => String(item.id) === String(saved.id));
    if (index >= 0) {
      leads[index] = { ...leads[index], ...saved, updatedAt: new Date().toISOString() };
      await writeLeadList(leads, project);
    } else {
      await appendJsonlRecord(targetFile, saved);
    }
    return saved;
  });
}

function normalizeServerLead(lead = {}) {
  const delivery = lead.delivery || {};
  return {
    ...lead,
    id: lead.id || randomId(),
    type: isReservationLeadPolicy(lead) ? '방문예약' : '상담신청',
    status: ['신규', '확인중', '연락완료', '예약완료', '보류', '종료'].includes(lead.status) ? lead.status : '신규',
    memo: lead.memo || '',
    createdAt: lead.createdAt || lead.savedAt || new Date().toISOString(),
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    values: lead.values || {},
    delivery: {
      status: delivery.status || 'none',
      summary: delivery.summary || '외부 전송 없음',
      logs: Array.isArray(delivery.logs) ? delivery.logs.slice(-20) : [],
      ...(delivery.retry ? { retry: delivery.retry } : {}),
    },
  };
}

async function findDuplicateLead(lead = {}, project = {}) {
  const phone = normalizeLeadContact(lead.phone);
  const email = normalizeLeadContact(lead.email);
  if (!phone && !email) return null;

  const windowMs = duplicatePolicyWindowMs(lead.duplicateWindow || lead.duplicateWindowKey || '1d');
  const now = Date.now();
  const leads = await readLeadList(project);
  return leads.find((item) => {
    if (!sameLeadKindPolicy(item, lead)) return false;
    const time = Date.parse(item.createdAt || item.savedAt || '');
    if (!Number.isNaN(time) && now - time > windowMs) return false;
    return (phone && normalizeLeadContact(item.phone) === phone) || (email && normalizeLeadContact(item.email) === email);
  }) || null;
}

async function findD1DuplicateLead(lead = {}, project = {}) {
  const phone = normalizeLeadContact(lead.phone);
  const email = normalizeLeadContact(lead.email);
  if (!phone && !email) return null;
  const month = String(lead.createdAt || lead.savedAt || new Date().toISOString()).slice(0, 7);
  const candidates = await findD1LeadsByContact(storageRuntime.d1, {
    projectId: normalizeProject(project).projectId,
    month,
    phone,
    email,
    limit: 100,
  });
  const windowMs = duplicatePolicyWindowMs(lead.duplicateWindow || lead.duplicateWindowKey || '1d');
  const now = Date.now();
  return (candidates || []).find((item) => {
    if (!sameLeadKindPolicy(item, lead)) return false;
    const time = Date.parse(item.createdAt || item.savedAt || '');
    if (!Number.isNaN(time) && now - time > windowMs) return false;
    return (phone && normalizeLeadContact(item.phone) === phone) || (email && normalizeLeadContact(item.email) === email);
  }) || null;
}

function eventFingerprint(event = {}) {
  return [
    event.type,
    event.label,
    event.channel,
    event.device,
  ].map((value) => String(value || '').trim().toLowerCase()).join('|');
}

async function findDuplicateEvent(file, event, dedupeMs = 0) {
  if (!dedupeMs) return null;
  const time = Date.parse(event.createdAt || '');
  if (Number.isNaN(time)) return null;
  const fingerprint = eventFingerprint(event);
  const events = await readEventListFromFile(file);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const candidate = events[index];
    if (eventFingerprint(candidate) !== fingerprint) continue;
    const candidateTime = Date.parse(candidate.createdAt || '');
    if (Number.isNaN(candidateTime)) continue;
    if (Math.abs(time - candidateTime) <= dedupeMs) return candidate;
    if (time - candidateTime > dedupeMs) return null;
  }
  return null;
}

async function saveEvent(body = {}) {
  const event = body.event || body;
  if (!event || typeof event !== 'object' || !event.type) {
    const error = new Error('event 객체가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const project = hasProject(body.project) ? normalizeProject(body.project) : {};
  const saved = {
    ...event,
    id: event.id || randomId(),
    type: String(event.type || ''),
    label: String(event.label || ''),
    channel: String(event.channel || 'direct'),
    device: String(event.device || 'desktop'),
    createdAt: event.createdAt || new Date().toISOString(),
    ...(hasProject(project) ? { project } : {}),
  };
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    return insertD1Event(storageRuntime.d1, saved, {
      projectId: project.projectId,
      pageSlug: project.slug || body.page?.slug || '',
    });
  }
  const targetFile = projectEventsFile(project) || path.join(dataDir, 'events.jsonl');
  await mkdir(path.dirname(targetFile), { recursive: true });
  return withFileLock(targetFile, async () => {
    const duplicate = await findDuplicateEvent(targetFile, saved, eventRetentionConfig.dedupeMs);
    if (duplicate) return { ...duplicate, deduped: true };
    await appendJsonlRecord(targetFile, saved);
    await pruneEventFile(targetFile, eventRetentionConfig.maxRecords);
    return saved;
  });
}

async function pruneEventFile(file, maxRecords = 20000) {
  if (!maxRecords || maxRecords < 1) return;
  const events = await readEventListFromFile(file);
  if (events.length <= maxRecords) return;
  await writeEventListToFile(file, events.slice(-maxRecords));
}

async function readEventList(project = {}) {
  const targetFile = projectEventsFile(project) || path.join(dataDir, 'events.jsonl');
  return readEventListFromFile(targetFile);
}

async function readEventListFromFile(targetFile) {
  const parsed = await readJsonlFile(targetFile);
  return parsed.records;
}

async function writeEventListToFile(file, events) {
  await mkdir(path.dirname(file), { recursive: true });
  await backupJsonlFile(file, 'events-rewrite');
  await writeJsonlRecords(file, events);
}

function itemTime(item = {}) {
  const time = new Date(item.createdAt || item.savedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function monthBounds(month = '') {
  const text = String(month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(text)) return {};
  const [year, monthIndex] = text.split('-').map(Number);
  const end = new Date(year, monthIndex, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return {
    dateFrom: `${year}-${pad(monthIndex)}-01`,
    dateTo: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

function normalizeDateFilters(filters = {}) {
  const month = monthBounds(filters.month);
  const dateFrom = String(filters.dateFrom || month.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || month.dateTo || '').trim();
  return { ...filters, dateFrom, dateTo };
}

function assertCsvDateRange(filters = {}) {
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();
  if (!dateFrom || !dateTo) {
    const error = new Error('CSV export requires a month or date range.');
    error.status = 400;
    throw error;
  }

  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T23:59:59.999`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
    const error = new Error('CSV export date range is invalid.');
    error.status = 400;
    throw error;
  }

  const maxTo = new Date(from);
  maxTo.setMonth(maxTo.getMonth() + 1);
  if (to >= maxTo) {
    const error = new Error('CSV export date range must be one month or less.');
    error.status = 400;
    throw error;
  }
}

function dateFiltersFromQuery(url) {
  return normalizeDateFilters({
    month: url.searchParams.get('month') || '',
    dateFrom: url.searchParams.get('dateFrom') || '',
    dateTo: url.searchParams.get('dateTo') || '',
  });
}

function dateRangeFilter(item = {}, filters = {}) {
  const time = itemTime(item);
  if (!time) return false;
  if (filters.dateFrom && time < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
  if (filters.dateTo && time > new Date(`${filters.dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

function storageQueryPlan(type = 'records', filters = {}) {
  const normalized = normalizeDateFilters(filters || {});
  const fields = type === 'events'
    ? ['project', 'page', 'month', 'eventType']
    : type === 'stats'
      ? ['project', 'page', 'month', 'eventType', 'status', 'kind', 'deliveryStatus']
      : ['project', 'page', 'month', 'status', 'kind', 'deliveryStatus'];
  const indexKey = fields.join('+');
  const boundedBy = {
    month: String(normalized.month || '').trim(),
    dateFrom: normalized.dateFrom || '',
    dateTo: normalized.dateTo || '',
    status: String(filters.status || '').trim(),
    kind: String(filters.kind || '').trim(),
    deliveryStatus: String(filters.deliveryStatus || '').trim(),
    eventType: String(filters.eventType || filters.type || '').trim(),
  };
  const activeIndexFields = fields.filter((field) => {
    if (field === 'project' || field === 'page') return true;
    if (field === 'month') return !!boundedBy.month || (!!boundedBy.dateFrom && !!boundedBy.dateTo);
    if (field === 'eventType') return !!boundedBy.eventType;
    return !!boundedBy[field];
  });
  const runtimePlan = storageRuntimePlan(storageRuntime, type, filters, {
    indexReadyFields: fields,
    activeIndexFields,
    recommendedIndex: indexKey,
    indexKey,
    boundedBy,
    migrationPriority: storageMigrationPriority(type, activeIndexFields),
  });
  if (runtimePlan) return runtimePlan;
  return {
    adapter: 'jsonl',
    indexed: false,
    fullScan: true,
    indexReadyFields: fields,
    activeIndexFields,
    missingIndexFields: fields.filter((field) => !activeIndexFields.includes(field)),
    recommendedIndex: indexKey,
    indexKey,
    migrationPriority: storageMigrationPriority(type, activeIndexFields),
    nextAdapter: 'db-index',
    boundedBy,
  };
}

function storageMigrationPriority(type = 'records', activeIndexFields = []) {
  if (type === 'stats') return 'high';
  if (type === 'events' && activeIndexFields.includes('month')) return 'high';
  if (activeIndexFields.includes('deliveryStatus')) return 'high';
  if (activeIndexFields.includes('month')) return 'medium';
  return 'low';
}

async function listEventsPage(limit, project = {}, cursor = 0, filters = {}) {
  const dateFilters = normalizeDateFilters(filters);
  if (storageRuntime.active === 'd1' && hasProject(project) && dateFilters.month) {
    const result = await listD1Events(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      month: dateFilters.month,
      eventType: String(dateFilters.eventType || dateFilters.type || '').trim(),
      cursor,
      limit,
    });
    return {
      events: result.records,
      total: result.total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      queryPlan: storageQueryPlan('events', dateFilters),
    };
  }
  const targetFile = projectEventsFile(project) || path.join(dataDir, 'events.jsonl');
  const plan = storageQueryPlan('events', dateFilters);
  const result = await queryJsonlRecords(targetFile, {
    type: 'events',
    filters: dateFilters,
    limit,
    cursor,
    filter: (event) => !(dateFilters.dateFrom || dateFilters.dateTo) || dateRangeFilter(event, dateFilters),
    plan,
  });
  return {
    events: result.records,
    total: result.total,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    queryPlan: result.queryPlan,
  };
}

async function readLeadList(project = {}) {
  const targetFile = projectLeadsFile(project) || leadsFile;
  const parsed = await readJsonlFile(targetFile);
  return parsed.records;
}

async function writeLeadList(leads, project = {}) {
  const targetFile = projectLeadsFile(project) || leadsFile;
  await mkdir(path.dirname(targetFile), { recursive: true });
  await backupJsonlFile(targetFile, 'leads-rewrite');
  await writeJsonlRecords(targetFile, leads);
}

async function backupJsonlFile(file, reason = 'rewrite') {
  if (!existsSync(file)) return null;
  const safeReason = safeId(reason, 'rewrite');
  const backupDir = path.join(path.dirname(file), '.backups');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `${path.basename(file)}.${stamp}.${safeReason}.bak`);
  await mkdir(backupDir, { recursive: true });
  await copyFile(file, backupFile);
  return backupFile;
}

async function readJsonlFile(file) {
  return readJsonlRecords(file);
}

function jsonlTargetFile(project = {}, type = 'leads') {
  const normalizedType = String(type || 'leads').trim();
  if (normalizedType === 'events') return projectEventsFile(project) || path.join(dataDir, 'events.jsonl');
  if (normalizedType === 'leads') return projectLeadsFile(project) || leadsFile;
  const error = new Error('Unsupported JSONL backup type.');
  error.status = 400;
  throw error;
}

async function jsonlFileSummary(file) {
  const parsed = await readJsonlFile(file);
  if (!parsed.exists) return { exists: false, bytes: 0, lines: 0, validLines: 0, invalidLines: 0 };
  return {
    exists: true,
    bytes: Buffer.byteLength(parsed.raw, 'utf8'),
    lines: parsed.lines,
    validLines: parsed.records.length,
    invalidLines: parsed.invalid.length,
  };
}

async function listJsonlBackups(project = {}, options = {}) {
  const targetFile = jsonlTargetFile(hasProject(project) ? normalizeProject(project) : {}, options.type || 'leads');
  const backupDir = path.join(path.dirname(targetFile), '.backups');
  let entries = [];
  try {
    entries = await readdir(backupDir, { withFileTypes: true });
  } catch {
    return {
      type: options.type || 'leads',
      target: path.basename(targetFile),
      current: await jsonlFileSummary(targetFile),
      backups: [],
    };
  }

  const prefix = `${path.basename(targetFile)}.`;
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith('.bak')) continue;
    const file = path.join(backupDir, entry.name);
    backups.push({
      id: entry.name,
      file: entry.name,
      summary: await jsonlFileSummary(file),
    });
  }
  backups.sort((a, b) => String(b.file).localeCompare(String(a.file)));
  return {
    type: options.type || 'leads',
    target: path.basename(targetFile),
    current: await jsonlFileSummary(targetFile),
    backups,
  };
}

async function restoreJsonlBackup(project = {}, options = {}) {
  const type = options.type || 'leads';
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const targetFile = jsonlTargetFile(targetProject, type);
  const backupName = path.basename(String(options.backup || ''));
  if (!backupName || backupName !== String(options.backup || '')) {
    const error = new Error('Valid backup id is required.');
    error.status = 400;
    throw error;
  }

  const backupFile = path.join(path.dirname(targetFile), '.backups', backupName);
  const prefix = `${path.basename(targetFile)}.`;
  if (!backupName.startsWith(prefix) || !backupName.endsWith('.bak') || !existsSync(backupFile)) {
    const error = new Error('Backup not found.');
    error.status = 404;
    throw error;
  }

  const before = await jsonlFileSummary(targetFile);
  const backup = await jsonlFileSummary(backupFile);
  const dryRun = options.confirm !== true;
  if (dryRun) {
    return { type, dryRun: true, target: path.basename(targetFile), before, backup };
  }

  return withFileLock(targetFile, async () => {
    const currentBackup = await backupJsonlFile(targetFile, `${type}-pre-restore`);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await copyFile(backupFile, targetFile);
    return {
      type,
      dryRun: false,
      target: path.basename(targetFile),
      before,
      backup,
      currentBackup: currentBackup ? path.basename(currentBackup) : null,
      after: await jsonlFileSummary(targetFile),
    };
  });
}

function jsonlInvalidLineReport(invalid = []) {
  return invalid.map((item) => ({
    line: item.line,
    error: item.error,
    preview: String(item.text || '').slice(0, 240),
    bytes: Buffer.byteLength(String(item.text || ''), 'utf8'),
  }));
}

async function jsonlRepairReport(project = {}, options = {}) {
  const type = options.type || 'leads';
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const targetFile = jsonlTargetFile(targetProject, type);
  const parsed = await readJsonlFile(targetFile);
  return {
    type,
    target: path.basename(targetFile),
    current: await jsonlFileSummary(targetFile),
    invalidLines: jsonlInvalidLineReport(parsed.invalid),
  };
}

async function quarantineJsonlLines(targetFile, invalid = [], type = 'leads') {
  if (!invalid.length) return null;
  const quarantineDir = path.join(path.dirname(targetFile), '.quarantine');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const quarantineFile = path.join(quarantineDir, `${path.basename(targetFile)}.${stamp}.${safeId(type, 'jsonl')}-invalid.jsonl`);
  const quarantinedAt = new Date().toISOString();
  const body = invalid
    .map((item) => JSON.stringify({
      line: item.line,
      error: item.error,
      text: item.text,
      quarantinedAt,
    }))
    .join('\n');
  await mkdir(quarantineDir, { recursive: true });
  await writeFile(quarantineFile, `${body}\n`, 'utf8');
  return quarantineFile;
}

async function repairJsonlFile(project = {}, options = {}) {
  const type = options.type || 'leads';
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const targetFile = jsonlTargetFile(targetProject, type);
  const dryRun = options.confirm !== true;
  if (dryRun) {
    return { dryRun: true, ...(await jsonlRepairReport(targetProject, { type })) };
  }

  return withFileLock(targetFile, async () => {
    const parsed = await readJsonlFile(targetFile);
    const before = await jsonlFileSummary(targetFile);
    if (!parsed.invalid.length) {
      return {
        type,
        dryRun: false,
        changed: false,
        target: path.basename(targetFile),
        before,
        after: before,
        invalidLines: [],
      };
    }

    const currentBackup = await backupJsonlFile(targetFile, `${type}-pre-repair`);
    const quarantine = await quarantineJsonlLines(targetFile, parsed.invalid, type);
    const body = parsed.records.length ? `${parsed.records.map((record) => JSON.stringify(record)).join('\n')}\n` : '';
    await mkdir(path.dirname(targetFile), { recursive: true });
    await writeFile(targetFile, body, 'utf8');
    return {
      type,
      dryRun: false,
      changed: true,
      target: path.basename(targetFile),
      repaired: parsed.invalid.length,
      kept: parsed.records.length,
      before,
      currentBackup: currentBackup ? path.basename(currentBackup) : null,
      quarantine: quarantine ? path.basename(quarantine) : null,
      invalidLines: jsonlInvalidLineReport(parsed.invalid),
      after: await jsonlFileSummary(targetFile),
    };
  });
}

function serverLeadSearchText(lead = {}) {
  const values = lead.values && typeof lead.values === 'object'
    ? Object.values(lead.values).join(' ')
    : '';
  const answers = Array.isArray(lead.answers)
    ? lead.answers.map((answer) => `${answer.label || ''} ${answer.value || ''}`).join(' ')
    : '';
  return [
    lead.name,
    lead.phone,
    normalizeLeadContact(lead.phone),
    lead.email,
    normalizeLeadContact(lead.email),
    lead.memo,
    lead.status,
    lead.type,
    lead.sourceBlockTitle,
    lead.message,
    values,
    answers,
  ].join(' ').toLowerCase();
}

function matchesLeadFilters(lead = {}, filters = {}) {
  const dateFilters = normalizeDateFilters(filters);
  const kind = String(filters.kind || '').trim();
  const status = String(filters.status || '').trim();
  const deliveryStatus = String(filters.deliveryStatus || '').trim();
  const query = String(filters.q || '').trim().toLowerCase();
  const dateFrom = String(dateFilters.dateFrom || '').trim();
  const dateTo = String(dateFilters.dateTo || '').trim();
  if ((dateFrom || dateTo) && !dateRangeFilter(lead, { dateFrom, dateTo })) return false;
  if (kind === 'reservation' && !isReservationLeadPolicy(lead)) return false;
  if (kind === 'consult' && isReservationLeadPolicy(lead)) return false;
  if (status && status !== 'all' && String(lead.status || '') !== status) return false;
  if (deliveryStatus === 'needs-attention' && !['failed', 'partial'].includes(lead.delivery?.status)) return false;
  if (deliveryStatus && !['all', 'needs-attention'].includes(deliveryStatus) && lead.delivery?.status !== deliveryStatus) return false;
  if (query && !serverLeadSearchText(lead).includes(query)) return false;
  return true;
}

async function listLeadsPage(limit, project = {}, cursor = 0, filters = {}) {
  if (storageRuntime.active === 'd1' && hasProject(project) && canUseD1LeadList(filters)) {
    const dateFilters = normalizeDateFilters(filters);
    const result = await listD1Leads(storageRuntime.d1, {
      projectId: project.projectId,
      month: dateFilters.month,
      status: filters.status && filters.status !== 'all' ? filters.status : '',
      kind: d1LeadKindFilter(filters.kind),
      deliveryStatus: d1LeadDeliveryStatusFilter(filters.deliveryStatus),
      q: String(filters.q || '').trim(),
      cursor,
      limit,
    });
    return {
      leads: result.records,
      total: result.total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      queryPlan: storageQueryPlan('leads', filters),
    };
  }

  const targetFile = projectLeadsFile(project) || leadsFile;
  const plan = storageQueryPlan('leads', filters);
  const result = await queryJsonlRecords(targetFile, {
    type: 'leads',
    filters,
    limit,
    cursor,
    filter: (lead) => matchesLeadFilters(lead, filters),
    plan,
  });
  return {
    leads: result.records,
    total: result.total,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    queryPlan: result.queryPlan,
  };
}

function canUseD1LeadList(filters = {}) {
  const dateFilters = normalizeDateFilters(filters);
  if (!dateFilters.month) return false;
  if (String(filters.kind || '').trim() && !d1LeadKindFilter(filters.kind)) return false;
  if (String(filters.deliveryStatus || '').trim() && !d1LeadDeliveryStatusFilter(filters.deliveryStatus)) return false;
  return true;
}

function d1LeadKindFilter(value = '') {
  const kind = String(value || '').trim();
  if (!kind || kind === 'all') return '';
  if (kind === 'reservation') return '방문예약';
  if (kind === 'consult') return '상담신청';
  return kind;
}

function d1LeadDeliveryStatusFilter(value = '') {
  const status = String(value || '').trim();
  if (!status || status === 'all' || status === 'needs-attention') return '';
  return status;
}

async function listD1LeadsForExport(project = {}, filters = {}) {
  const dateFilters = normalizeDateFilters(filters);
  const records = [];
  let cursor = 0;
  let guard = 0;
  do {
    const page = await listD1Leads(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      month: dateFilters.month,
      status: filters.status && filters.status !== 'all' ? filters.status : '',
      kind: d1LeadKindFilter(filters.kind),
      deliveryStatus: d1LeadDeliveryStatusFilter(filters.deliveryStatus),
      q: String(filters.q || '').trim(),
      cursor,
      limit: 100,
    });
    records.push(...(page.records || []));
    cursor = page.nextCursor;
    guard += 1;
    if (guard > 1000) break;
  } while (cursor != null && records.length < 100000);
  return records.filter((lead) => matchesLeadFilters(lead, filters));
}

async function listD1EventsForStats(project = {}, filters = {}) {
  const dateFilters = normalizeDateFilters(filters);
  const records = [];
  let cursor = 0;
  let guard = 0;
  do {
    const page = await listD1Events(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      month: dateFilters.month,
      eventType: String(dateFilters.eventType || dateFilters.type || '').trim(),
      cursor,
      limit: 500,
    });
    records.push(...(page.records || []));
    cursor = page.nextCursor;
    guard += 1;
    if (guard > 1000) break;
  } while (cursor != null && records.length < 500000);
  return records.filter((event) => !(dateFilters.dateFrom || dateFilters.dateTo) || dateRangeFilter(event, dateFilters));
}

async function statsSummary(project = {}, filters = {}) {
  const dateFilters = normalizeDateFilters(filters);
  const period = String(filters.period || 'thisMonth').trim() || 'thisMonth';
  const eventPlan = storageQueryPlan('stats', dateFilters);
  if (storageRuntime.active === 'd1' && hasProject(project) && dateFilters.month) {
    const d1Stats = await aggregateD1Stats(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      month: dateFilters.month,
      dateFrom: dateFilters.dateFrom || '',
      dateTo: dateFilters.dateTo || '',
    });
    return {
      source: 'server',
      project: normalizeProject(project),
      period,
      dateFrom: dateFilters.dateFrom || '',
      dateTo: dateFilters.dateTo || '',
      totals: d1Stats.totals,
      queryPlan: {
        ...eventPlan,
        aggregate: true,
        rowHydration: false,
        events: storageQueryPlan('events', dateFilters),
        leads: storageQueryPlan('leads', dateFilters),
      },
      summary: d1Stats.summary,
    };
  }
  const [eventsResult, leadsResult] = await Promise.all([
    queryJsonlRecords(projectEventsFile(project) || path.join(dataDir, 'events.jsonl'), {
      type: 'stats-events',
      filters: dateFilters,
      limit: Number.MAX_SAFE_INTEGER,
      cursor: 0,
      reverse: false,
      filter: (event) => !(dateFilters.dateFrom || dateFilters.dateTo) || dateRangeFilter(event, dateFilters),
      plan: eventPlan,
    }),
    queryJsonlRecords(projectLeadsFile(project) || leadsFile, {
      type: 'stats-leads',
      filters: dateFilters,
      limit: Number.MAX_SAFE_INTEGER,
      cursor: 0,
      reverse: false,
      filter: (lead) => matchesLeadFilters(lead, dateFilters),
      plan: eventPlan,
    }),
  ]);
  const scopedEvents = eventsResult.records;
  const scopedLeads = leadsResult.records;
  const stats = buildStatsSummary(scopedEvents, scopedLeads, period);
  const { filteredEvents: _events, filteredLeads: _leads, ...summary } = stats;
  return {
    source: 'server',
    project: hasProject(project) ? normalizeProject(project) : {},
    period,
    dateFrom: dateFilters.dateFrom || '',
    dateTo: dateFilters.dateTo || '',
    totals: {
      events: scopedEvents.length,
      leads: scopedLeads.length,
      filteredEvents: _events.length,
      filteredLeads: _leads.length,
    },
    queryPlan: {
      ...eventPlan,
      events: eventsResult.queryPlan,
      leads: leadsResult.queryPlan,
    },
    summary,
  };
}

async function updateLead(id, patch = {}, project = {}) {
  if (!id) {
    const error = new Error('Lead id is required.');
    error.status = 400;
    throw error;
  }

  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  if (storageRuntime.active === 'd1' && hasProject(targetProject)) {
    const current = await getD1Lead(storageRuntime.d1, { projectId: targetProject.projectId, id });
    if (!current) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }
    assertLeadVersion(current, patch, id);
    const safePatch = sanitizedLeadPatch(patch);
    const nextLead = { ...current, ...safePatch, updatedAt: new Date().toISOString() };
    return upsertD1Lead(storageRuntime.d1, nextLead, {
      projectId: targetProject.projectId,
      pageSlug: targetProject.slug || current.pageSlug || '',
    });
  }

  const targetFile = projectLeadsFile(targetProject) || leadsFile;
  return withFileLock(targetFile, async () => {
    const leads = await readLeadList(targetProject);
    const index = leads.findIndex((lead) => String(lead.id) === String(id));
    if (index < 0) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }

    assertLeadVersion(leads[index], patch, id);
    const safePatch = sanitizedLeadPatch(patch);
    leads[index] = { ...leads[index], ...safePatch, updatedAt: new Date().toISOString() };
    await writeLeadList(leads, targetProject);
    return leads[index];
  });
}

function assertLeadVersion(current = {}, patch = {}, id = '') {
  const expectedUpdatedAt = patch.__expectedUpdatedAt || patch.expectedUpdatedAt || '';
  const currentVersion = current.updatedAt || current.savedAt || current.createdAt || '';
  if (expectedUpdatedAt && currentVersion && String(expectedUpdatedAt) !== String(currentVersion)) {
    const error = new Error('Lead was changed elsewhere. Reload before saving.');
    error.status = 409;
    error.details = {
      code: 'LEAD_REVISION_CONFLICT',
      latest: {
        id: current.id || id,
        updatedAt: current.updatedAt || '',
        savedAt: current.savedAt || '',
        createdAt: current.createdAt || '',
        status: current.status || '',
      },
    };
    throw error;
  }
}

function sanitizedLeadPatch(patch = {}) {
  const safePatch = { ...patch };
  delete safePatch.id;
  delete safePatch.project;
  delete safePatch.__expectedUpdatedAt;
  delete safePatch.expectedUpdatedAt;
  return safePatch;
}

async function deleteLead(id, project = {}) {
  if (!id) {
    const error = new Error('Lead id is required.');
    error.status = 400;
    throw error;
  }

  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  if (storageRuntime.active === 'd1' && hasProject(targetProject)) {
    const current = await getD1Lead(storageRuntime.d1, { projectId: targetProject.projectId, id });
    if (!current) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }
    return deleteD1Lead(storageRuntime.d1, { projectId: targetProject.projectId, id });
  }

  const targetFile = projectLeadsFile(targetProject) || leadsFile;
  return withFileLock(targetFile, async () => {
    const leads = await readLeadList(targetProject);
    const next = leads.filter((lead) => String(lead.id) !== String(id));
    if (next.length === leads.length) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }

    await writeLeadList(next, targetProject);
    return { id };
  });
}

async function deliverLead(id, body = {}) {
  const project = hasProject(body.project) ? normalizeProject(body.project) : {};
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    const current = await getD1Lead(storageRuntime.d1, { projectId: project.projectId, id });
    if (!current) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }
    const baseLead = { ...current, ...(body.lead || {}) };
    const deliveryPage = deliveryPageFrom(body.page || baseLead.deliveryPage || baseLead.page || {});
    const delivery = await sendServerLeadIntegrations(baseLead, deliveryPage);
    return upsertD1Lead(storageRuntime.d1, {
      ...baseLead,
      delivery,
      deliveryPage,
      updatedAt: new Date().toISOString(),
    }, {
      projectId: project.projectId,
      pageSlug: project.slug || baseLead.pageSlug || '',
    });
  }

  const targetFile = projectLeadsFile(project) || leadsFile;
  return withFileLock(targetFile, async () => {
    const leads = await readLeadList(project);
    const index = leads.findIndex((lead) => String(lead.id) === String(id));
    if (index < 0) {
      const error = new Error('Lead not found.');
      error.status = 404;
      throw error;
    }

    const baseLead = { ...leads[index], ...(body.lead || {}) };
    const deliveryPage = deliveryPageFrom(body.page || baseLead.deliveryPage || baseLead.page || {});
    const delivery = await sendServerLeadIntegrations(baseLead, deliveryPage);
    leads[index] = { ...baseLead, delivery, deliveryPage, updatedAt: new Date().toISOString() };
    await writeLeadList(leads, project);
    return leads[index];
  });
}

async function retryFailedLeads(body = {}) {
  const project = hasProject(body.project) ? normalizeProject(body.project) : {};
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    return retryFailedD1Leads(body, project);
  }

  const targetFile = projectLeadsFile(project) || leadsFile;
  return withFileLock(targetFile, async () => {
  const leads = await readLeadList(project);
  let retried = 0;
  const summary = { success: 0, failed: 0, partial: 0, deadLetter: 0, skipped: 0 };
  const leadId = String(body.leadId || '').trim();

  for (let i = 0; i < leads.length; i += 1) {
    if (leadId && String(leads[i]?.id || '') !== leadId) continue;
    if (!['failed', 'partial'].includes(leads[i]?.delivery?.status)) {
      summary.skipped += 1;
      continue;
    }
    const deliveryPage = deliveryPageFrom(body.page || leads[i].deliveryPage || leads[i].page || {});
    const delivery = await sendServerLeadIntegrations(leads[i], deliveryPage);
    const previousRetry = leads[i].delivery?.retry || {};
    const attempts = Number(previousRetry.attempts || 0) + 1;
    const deadLetter = delivery.status !== 'success' && attempts >= deliveryRetryConfig.maxAttempts;
    const retry = {
      attempts,
      maxAttempts: deliveryRetryConfig.maxAttempts,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: delivery.status === 'success' || deadLetter
        ? ''
        : new Date(Date.now() + deliveryRetryConfig.intervalMs).toISOString(),
      ...(deadLetter ? { deadLetter: true, deadLetterAt: new Date().toISOString() } : {}),
    };
    leads[i] = {
      ...leads[i],
      delivery: {
        ...delivery,
        retry,
      },
      deliveryPage,
      updatedAt: new Date().toISOString(),
    };
    if (delivery.status === 'success') summary.success += 1;
    else if (delivery.status === 'partial') summary.partial += 1;
    else summary.failed += 1;
    if (deadLetter) summary.deadLetter += 1;
    retried += 1;
  }

  if (retried) await writeLeadList(leads, project);
  const queue = summarizeDeliveryRetryQueue(leads);
  return { retried, ...summary, queue, leads: leads.slice().reverse() };
  });
}

async function retryFailedD1Leads(body = {}, project = {}) {
  const leadId = String(body.leadId || '').trim();
  const month = String(body.month || new Date().toISOString().slice(0, 7)).trim();
  let candidates = [];
  if (leadId) {
    const lead = await getD1Lead(storageRuntime.d1, { projectId: project.projectId, id: leadId });
    if (lead) candidates = [lead];
  } else {
    const [failed, partial] = await Promise.all([
      listD1Leads(storageRuntime.d1, { projectId: project.projectId, month, deliveryStatus: 'failed', limit: 100 }),
      listD1Leads(storageRuntime.d1, { projectId: project.projectId, month, deliveryStatus: 'partial', limit: 100 }),
    ]);
    candidates = [...(failed.records || []), ...(partial.records || [])];
  }

  let retried = 0;
  const summary = { success: 0, failed: 0, partial: 0, deadLetter: 0, skipped: 0 };
  const leads = [];
  for (const lead of candidates) {
    if (!['failed', 'partial'].includes(lead.delivery?.status)) {
      summary.skipped += 1;
      continue;
    }
    const deliveryPage = deliveryPageFrom(body.page || lead.deliveryPage || lead.page || {});
    const delivery = await sendServerLeadIntegrations(lead, deliveryPage);
    const previousRetry = lead.delivery?.retry || {};
    const attempts = Number(previousRetry.attempts || 0) + 1;
    const deadLetter = delivery.status !== 'success' && attempts >= deliveryRetryConfig.maxAttempts;
    const retry = {
      attempts,
      maxAttempts: deliveryRetryConfig.maxAttempts,
      lastAttemptAt: new Date().toISOString(),
      nextRetryAt: delivery.status === 'success' || deadLetter
        ? ''
        : new Date(Date.now() + deliveryRetryConfig.intervalMs).toISOString(),
      ...(deadLetter ? { deadLetter: true, deadLetterAt: new Date().toISOString() } : {}),
    };
    const saved = await upsertD1Lead(storageRuntime.d1, {
      ...lead,
      delivery: { ...delivery, retry },
      deliveryPage,
      updatedAt: new Date().toISOString(),
    }, {
      projectId: project.projectId,
      pageSlug: project.slug || lead.pageSlug || '',
    });
    leads.push(saved);
    if (delivery.status === 'success') summary.success += 1;
    else if (delivery.status === 'partial') summary.partial += 1;
    else summary.failed += 1;
    if (deadLetter) summary.deadLetter += 1;
    retried += 1;
  }

  const queue = await listD1DeliveryRetryQueue(storageRuntime.d1, { projectId: project.projectId, limit: 200 });
  return { retried, ...summary, queue, leads };
}

async function migrateLeads(project = {}, options = {}) {
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const targetFile = projectLeadsFile(targetProject) || leadsFile;
  return withFileLock(targetFile, async () => {
  const leads = await readLeadList(targetProject);
  const normalized = leads.map(normalizeServerLead);
  const changed = JSON.stringify(leads) !== JSON.stringify(normalized);
  if (changed && !options.dryRun) await writeLeadList(normalized, targetProject);
  return {
    dryRun: !!options.dryRun,
    changed,
    migrated: changed && !options.dryRun ? normalized.length : 0,
    pending: changed ? normalized.length : 0,
    total: normalized.length,
    leads: normalized.slice().reverse(),
  };
  });
}

async function listDeliveryLogs(project = {}, options = {}) {
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const limit = Math.max(1, Math.min(1000, Number(options.limit || 200)));
  const leadId = String(options.leadId || '').trim();
  const status = String(options.status || '').trim();
  const month = String(options.month || '').trim();
  const filters = { month, deliveryStatus: status || 'all' };
  if (storageRuntime.active === 'd1' && hasProject(targetProject)) {
    const result = await listD1DeliveryLogs(storageRuntime.d1, {
      projectId: targetProject.projectId,
      month,
      leadId,
      status,
      limit,
    });
    const logs = (result.records || []).map((log) => ({
      leadId: log.leadId || '',
      leadName: '',
      leadType: '',
      deliveryStatus: log.deliveryStatus || 'none',
      summary: log.error || '',
      retry: null,
      target: log.target || log.provider || '',
      status: log.deliveryStatus || log.status || '',
      message: log.error || '',
      idempotencyKey: log.idempotencyKey || '',
      at: log.at || log.createdAt || '',
    }));
    return {
      total: result.total,
      logs,
      queryPlan: storageQueryPlan('delivery-logs', filters),
    };
  }
  const plan = storageQueryPlan('leads', filters);
  const result = await queryJsonlRecords(projectLeadsFile(targetProject) || leadsFile, {
    type: 'delivery-logs',
    filters,
    limit: Number.MAX_SAFE_INTEGER,
    cursor: 0,
    reverse: false,
    filter: (lead) => {
      if (leadId && String(lead.id || '') !== leadId) return false;
      if (status && String(lead.delivery?.status || '') !== status) return false;
      return true;
    },
    plan,
  });
  const leads = result.records;
  const logs = [];

  for (const lead of leads) {
    if (leadId && String(lead.id || '') !== leadId) continue;
    const delivery = lead.delivery || {};
    if (status && String(delivery.status || '') !== status) continue;
    for (const log of Array.isArray(delivery.logs) ? delivery.logs : []) {
      logs.push({
        leadId: lead.id || '',
        leadName: lead.name || '',
        leadType: lead.type || '',
        deliveryStatus: delivery.status || 'none',
        summary: delivery.summary || '',
        retry: delivery.retry || null,
        target: log.target || '',
        status: log.status || '',
        message: log.message || '',
        idempotencyKey: log.idempotencyKey || '',
        at: log.at || lead.updatedAt || lead.savedAt || lead.createdAt || '',
      });
    }
  }

  logs.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return {
    total: logs.length,
    logs: logs.slice(0, limit),
    queryPlan: result.queryPlan,
  };
}

function deliveryRetryQueueEntry(lead = {}) {
  const delivery = lead.delivery || {};
  const retry = delivery.retry || {};
  const status = delivery.status || 'none';
  const deadLetter = !!retry.deadLetter;
  return {
    leadId: lead.id || '',
    leadName: lead.name || '',
    leadType: lead.type || '',
    deliveryStatus: status,
    summary: delivery.summary || '',
    attempts: Number(retry.attempts || 0),
    maxAttempts: Number(retry.maxAttempts || deliveryRetryConfig.maxAttempts),
    lastAttemptAt: retry.lastAttemptAt || '',
    nextRetryAt: retry.nextRetryAt || '',
    deadLetter,
    deadLetterAt: retry.deadLetterAt || '',
    canRetry: ['failed', 'partial'].includes(status) && !deadLetter,
    updatedAt: lead.updatedAt || lead.savedAt || lead.createdAt || '',
  };
}

function summarizeDeliveryRetryQueue(leads = []) {
  const entries = leads
    .filter((lead) => ['failed', 'partial'].includes(lead.delivery?.status || '') || lead.delivery?.retry?.deadLetter)
    .map(deliveryRetryQueueEntry);
  return {
    total: entries.length,
    retryable: entries.filter((entry) => entry.canRetry).length,
    deadLetter: entries.filter((entry) => entry.deadLetter).length,
    failed: entries.filter((entry) => entry.deliveryStatus === 'failed').length,
    partial: entries.filter((entry) => entry.deliveryStatus === 'partial').length,
  };
}

async function listDeliveryRetryQueue(project = {}, options = {}) {
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const limit = Math.max(1, Math.min(1000, Number(options.limit || 200)));
  const status = String(options.status || '').trim();
  const month = String(options.month || '').trim();
  const filters = { month, deliveryStatus: status || 'needs-attention' };
  if (storageRuntime.active === 'd1' && hasProject(targetProject)) {
    const result = await listD1DeliveryRetryQueue(storageRuntime.d1, {
      projectId: targetProject.projectId,
      status,
      limit,
    });
    return {
      ...result,
      queryPlan: storageQueryPlan('delivery-retry-queue', filters),
    };
  }
  const plan = storageQueryPlan('leads', filters);
  const result = await queryJsonlRecords(projectLeadsFile(targetProject) || leadsFile, {
    type: 'delivery-retry-queue',
    filters,
    limit: Number.MAX_SAFE_INTEGER,
    cursor: 0,
    reverse: false,
    filter: (lead) => ['failed', 'partial'].includes(lead.delivery?.status || '') || lead.delivery?.retry?.deadLetter,
    plan,
  });
  const leads = result.records;
  let entries = leads
    .map(deliveryRetryQueueEntry);

  if (status === 'dead-letter') entries = entries.filter((entry) => entry.deadLetter);
  else if (status) entries = entries.filter((entry) => entry.deliveryStatus === status);

  entries.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const summary = summarizeDeliveryRetryQueue(leads);
  return {
    ...summary,
    count: entries.length,
    entries: entries.slice(0, limit),
    queryPlan: result.queryPlan,
  };
}

async function compactLeads(project = {}, options = {}) {
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  const targetFile = projectLeadsFile(targetProject) || leadsFile;
  const dryRun = options.dryRun !== false;
  return withFileLock(targetFile, async () => {
    const leads = await readLeadList(targetProject);
    const latestById = new Map();
    const withoutId = [];

    for (const lead of leads) {
      const id = String(lead.id || '').trim();
      const normalized = normalizeServerLead(lead);
      if (!id) {
        withoutId.push(normalized);
        continue;
      }
      latestById.set(id, normalized);
    }

    const compacted = [...withoutId, ...latestById.values()];
    const removed = Math.max(0, leads.length - compacted.length);
    const changed = removed > 0 || JSON.stringify(leads) !== JSON.stringify(compacted);
    if (changed && !dryRun) await writeLeadList(compacted, targetProject);
    return {
      dryRun,
      changed,
      before: leads.length,
      after: compacted.length,
      removed,
    };
  });
}

function runLeadMigrationOnStart() {
  if (env.INLET_LEADS_MIGRATE_ON_START !== '1') return;
  migrateAllLeadFiles().then((result) => {
    console.log(`Lead migration complete: ${result.migrated}/${result.total} records across ${result.files} files`);
  }).catch((error) => {
    console.warn('Lead migration failed:', error);
  });
}

async function migrateAllLeadFiles() {
  const targets = await leadStorageTargets();
  let total = 0;
  let migrated = 0;

  for (const target of targets) {
    await withFileLock(target.file, async () => {
      const leads = await readLeadListFromFile(target.file);
      const normalized = leads.map(normalizeServerLead);
      total += normalized.length;
      if (JSON.stringify(leads) === JSON.stringify(normalized)) return;
      migrated += normalized.length;
      await writeLeadListToFile(target.file, normalized);
    });
  }

  return { files: targets.length, total, migrated };
}

function deliveryPageFrom(page = {}) {
  return {
    title: page.title || '',
    slug: page.slug || '',
    integrations: page.integrations || {},
  };
}

async function sendServerLeadIntegrations(lead, page = {}) {
  const jobs = buildServerIntegrationJobs(page.integrations || {}, lead, page);
  if (!jobs.length) {
    return { status: 'none', summary: '외부 전송 없음', logs: [] };
  }

  const settled = await Promise.allSettled(jobs.map(async (job) => {
    const res = await runServerIntegrationJob(job);
    return {
      target: job.label,
      status: res.ok ? 'success' : 'failed',
      message: res.ok ? '전송 완료' : (res.message || `응답 확인 필요${res.status ? ` · ${res.status}` : ''}`),
      idempotencyKey: job.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  }));

  const logs = settled.map((item, idx) => {
    const job = jobs[idx];
    if (item.status === 'fulfilled') return item.value;
    return {
      target: job?.label || '외부 전송',
      status: 'failed',
      message: String(item.reason?.message || item.reason || '전송 실패'),
      idempotencyKey: job?.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  });

  return summarizeServerDelivery(logs);
}

function buildServerIntegrationJobs(integrations = {}, lead = {}, page = {}) {
  const payload = {
    brand: 'Inlet',
    page: {
      title: page.title || '',
      slug: page.slug || '',
    },
    lead,
    createdAt: lead.createdAt || new Date().toISOString(),
  };
  const jobs = [];

  if (integrations.email?.enabled && isValidEmail(integrations.email.to) && shouldSendEmailForLead(integrations.email, lead)) {
    jobs.push({
      type: 'email',
      label: '이메일 알림',
      to: integrations.email.to,
      subject: `[${page.title || '랜딩페이지'}] ${lead.type || '상담신청'} 접수`,
      text: buildLeadEmailText(lead, page),
    });
  }

  if (integrations.webhook?.enabled && isValidHttpUrl(integrations.webhook.url)) {
    jobs.push({
      type: 'http',
      label: 'Webhook',
      url: integrations.webhook.url,
      payload: { ...payload, target: 'webhook', service: integrations.webhook.service || 'custom' },
      secret: integrations.webhook.secret || '',
    });
  }

  if (integrations.automation?.enabled && isValidHttpUrl(integrations.automation.url)) {
    jobs.push({
      type: 'http',
      label: `자동화 · ${serviceLabel(integrations.automation.service || 'make')}`,
      url: integrations.automation.url,
      payload: { ...payload, target: 'automation', service: integrations.automation.service || 'make' },
      secret: integrations.automation.secret || '',
    });
  }

  if (integrations.sheets?.enabled && isValidHttpUrl(integrations.sheets.url)) {
    jobs.push({
      type: 'http',
      label: '구글시트',
      url: integrations.sheets.url,
      payload: {
        ...payload,
        target: 'google_sheets',
        sheetName: integrations.sheets.sheetName || '접수함',
      },
      secret: integrations.sheets.secret || '',
    });
  }

  return jobs.map((job) => ({
    ...job,
    idempotencyKey: deliveryIdempotencyKey(lead, job),
  }));
}

async function runServerIntegrationJob(job) {
  if (job.type === 'email') return sendEmailNotification(job);
  return postServerIntegration(job.url, {
    ...(job.payload || {}),
    idempotencyKey: job.idempotencyKey || '',
  }, job.secret, job.idempotencyKey);
}

async function postServerIntegration(url, payload, secret = '', idempotencyKey = '') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), integrationHttpConfig.timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(jobHeaderValue(idempotencyKey) ? { 'X-Inlet-Idempotency-Key': jobHeaderValue(idempotencyKey) } : {}),
        ...(secret ? { 'X-Inlet-Secret': secret } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        status: 504,
        message: `Integration request timed out after ${Math.round(integrationHttpConfig.timeoutMs / 1000)}s`,
      };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return { ok: res.ok, status: res.status };
}

function deliveryIdempotencyKey(lead = {}, job = {}) {
  return [
    lead.id || '',
    lead.updatedAt || lead.savedAt || lead.createdAt || '',
    job.type || '',
    job.label || '',
  ]
    .map((value) => String(value || '').replace(/[^a-zA-Z0-9_.:-]/g, '-'))
    .filter(Boolean)
    .join(':')
    .slice(0, 180);
}

function jobHeaderValue(value = '') {
  return String(value || '').trim().slice(0, 180);
}

async function sendEmailNotification(job) {
  if (!smtpConfig.host || !smtpConfig.from) {
    return { ok: false, message: 'SMTP 설정 필요' };
  }

  try {
    await sendSmtpMail({
      to: job.to,
      from: smtpConfig.from,
      subject: job.subject,
      text: job.text,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
}

function shouldSendEmailForLead(email = {}, lead = {}) {
  if (lead.type === '방문예약') return email.reservation !== false;
  return email.consult !== false;
}

function buildLeadEmailText(lead = {}, page = {}) {
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerLines = answers.map((answer) => {
    const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-');
    return `- ${answer.label || answer.id || '항목'}: ${value}`;
  });

  return [
    `페이지: ${page.title || page.slug || '-'}`,
    `접수유형: ${lead.type || '-'}`,
    `접수시간: ${lead.createdAt || '-'}`,
    `이름: ${lead.name || '-'}`,
    `연락처: ${lead.phone || '-'}`,
    `이메일: ${lead.email || '-'}`,
    `주소: ${lead.address || '-'}`,
    `문의내용: ${lead.message || '-'}`,
    '',
    '[답변]',
    ...(answerLines.length ? answerLines : ['- 답변 없음']),
  ].join('\n');
}

async function sendSmtpMail({ to, from, subject, text }) {
  if (!isValidEmail(to)) throw new Error('받을 이메일 주소를 확인해주세요.');
  const socket = await openSmtpSocket();
  const session = createSmtpSession(socket);

  try {
    await session.expect([220]);
    await session.command(`EHLO ${smtpHostName()}`, [250]);
    if (!smtpConfig.secure && smtpConfig.port !== 465) {
      await session.command('STARTTLS', [220]);
      session.dispose();
      const secureSocket = await upgradeSmtpSocket(socket);
      const secureSession = createSmtpSession(secureSocket);
      await secureSession.command(`EHLO ${smtpHostName()}`, [250]);
      await smtpAuthenticate(secureSession);
      await sendSmtpEnvelope(secureSession, { to, from, subject, text });
      secureSocket.end();
      return;
    }
    await smtpAuthenticate(session);
    await sendSmtpEnvelope(session, { to, from, subject, text });
    socket.end();
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

function openSmtpSocket() {
  return new Promise((resolve, reject) => {
    const options = { host: smtpConfig.host, port: smtpConfig.port, servername: smtpConfig.host };
    const socket = smtpConfig.secure ? tls.connect(options) : net.connect(options);
    socket.setTimeout(15000);
    if (smtpConfig.secure) socket.once('secureConnect', () => resolve(socket));
    else socket.once('connect', () => resolve(socket));
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP 연결 시간 초과'));
    });
    socket.once('error', reject);
  });
}

function upgradeSmtpSocket(socket) {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: smtpConfig.host });
    secureSocket.once('secureConnect', () => resolve(secureSocket));
    secureSocket.once('error', reject);
  });
}

function createSmtpSession(socket) {
  let buffer = '';
  const waiters = [];

  const onData = (chunk) => {
    buffer += chunk.toString('utf8');
    flushSmtpWaiters();
  };
  socket.on('data', onData);

  function flushSmtpWaiters() {
    while (waiters.length) {
      const response = readSmtpResponse(buffer);
      if (!response) return;
      buffer = buffer.slice(response.length);
      waiters.shift().resolve(response.text);
    }
  }

  return {
    expect(codes) {
      return waitForSmtpResponse(codes);
    },
    async command(line, codes) {
      socket.write(`${line}\r\n`);
      return waitForSmtpResponse(codes);
    },
    writeData(data) {
      socket.write(data);
      return waitForSmtpResponse([250]);
    },
    dispose() {
      socket.off('data', onData);
    },
  };

  function waitForSmtpResponse(codes) {
    return new Promise((resolve, reject) => {
      waiters.push({
        resolve: (text) => {
          const code = Number(text.slice(0, 3));
          if (!codes.includes(code)) reject(new Error(`SMTP 응답 오류: ${text.trim()}`));
          else resolve(text);
        },
      });
      flushSmtpWaiters();
    });
  }
}

function readSmtpResponse(buffer) {
  const lines = buffer.split(/\r?\n/);
  let length = 0;
  const parts = [];
  for (const line of lines) {
    if (!line) break;
    length += line.length + 2;
    parts.push(line);
    if (/^\d{3} /.test(line)) return { text: parts.join('\n'), length };
  }
  return null;
}

async function smtpAuthenticate(session) {
  if (!smtpConfig.user && !smtpConfig.pass) return;
  const auth = Buffer.from(`\u0000${smtpConfig.user}\u0000${smtpConfig.pass}`).toString('base64');
  await session.command(`AUTH PLAIN ${auth}`, [235]);
}

async function sendSmtpEnvelope(session, { to, from, subject, text }) {
  await session.command(`MAIL FROM:<${from}>`, [250]);
  await session.command(`RCPT TO:<${to}>`, [250, 251]);
  await session.command('DATA', [354]);
  await session.writeData(buildSmtpMessage({ to, from, subject, text }));
  await session.command('QUIT', [221]);
}

function buildSmtpMessage({ to, from, subject, text }) {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    String(text || '').replace(/\r?\n\./g, '\n..'),
    '.',
    '',
  ].join('\r\n');
}

function encodeMimeHeader(value = '') {
  return `=?UTF-8?B?${Buffer.from(String(value), 'utf8').toString('base64')}?=`;
}

function smtpHostName() {
  return smtpConfig.host || 'localhost';
}

function summarizeServerDelivery(logs = []) {
  const safeLogs = logs.slice(-20);
  if (!safeLogs.length) return { status: 'none', summary: '외부 전송 없음', logs: [] };
  const ok = safeLogs.filter((log) => log.status === 'success').length;
  const fail = safeLogs.filter((log) => log.status === 'failed').length;
  if (ok && !fail) return { status: 'success', summary: `${ok}개 연결 전송 완료`, logs: safeLogs };
  if (ok && fail) return { status: 'partial', summary: `${ok}개 성공 · ${fail}개 실패`, logs: safeLogs };
  return { status: 'failed', summary: `${fail}개 연결 전송 실패`, logs: safeLogs };
}

function csvCell(value) {
  const text = neutralizeCsvFormula(value == null ? '' : String(value));
  return `"${text.replace(/"/g, '""')}"`;
}

function neutralizeCsvFormula(text) {
  const value = String(text || '').replace(/\0/g, '');
  const visibleStart = value.replace(/^[\s\uFEFF]+/, '');
  return /^[=+\-@]/.test(visibleStart) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
}

function csvFieldByLabel(lead = {}, patterns = []) {
  const values = lead.values || {};
  for (const [key, value] of Object.entries(values)) {
    if (patterns.some((pattern) => pattern.test(String(key)))) return Array.isArray(value) ? value.join(', ') : String(value || '');
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    if (patterns.some((pattern) => pattern.test(String(answer.label || answer.id || '')))) {
      return Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '');
    }
  }
  return '';
}

function csvDeliveryLogs(logs = []) {
  return (Array.isArray(logs) ? logs : [])
    .slice(-5)
    .map((log) => [log.target, log.status, log.message].filter(Boolean).join(': '))
    .join(' / ');
}

function leadsToCsvV2(leads = []) {
  const headers = [
    '접수ID',
    '접수유형',
    '상태',
    '접수시간',
    '이름',
    '대표연락처',
    '연락처',
    '이메일',
    '주소',
    '문의내용',
    '예약일',
    '예약시간',
    '메모',
    '외부 전송상태',
    '외부 전송요약',
    '외부 전송로그',
    '답변',
    '입력값',
  ];
  const rows = leads.map((lead) => [
    lead.id || '',
    lead.type || '',
    lead.status || '',
    formatCsvDate(lead.createdAt),
    lead.name || '',
    lead.phone || lead.email || lead.address || '',
    lead.phone || '',
    lead.email || '',
    lead.address || '',
    lead.message || '',
    csvFieldByLabel(lead, [/예약일|예약날짜|date/i]),
    csvFieldByLabel(lead, [/예약시간|시간|time/i]),
    lead.memo || '',
    deliveryStatusText(lead.delivery?.status),
    lead.delivery?.summary || '',
    csvDeliveryLogs(lead.delivery?.logs),
    csvAnswers(lead.answers),
    csvValues(lead.values),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
function csvAnswers(answers = []) {
  return (Array.isArray(answers) ? answers : [])
    .map((answer) => {
      const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '');
      return `${answer.label || answer.id || '항목'}: ${value}`;
    })
    .filter(Boolean)
    .join(' / ');
}

function csvValues(values = {}) {
  return Object.entries(values || {})
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value || '')}`)
    .filter(Boolean)
    .join(' / ');
}

function formatCsvDate(value = '') {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function deliveryStatusText(status = 'none') {
  return {
    pending: '전송중',
    success: '전송완료',
    failed: '전송실패',
    partial: '일부실패',
    none: '미연결',
  }[status] || '미연결';
}

function csvFileName(slug = 'my-page') {
  const safeSlug = safeSlugForFile(slug || 'my-page');
  const date = new Date().toISOString().slice(0, 10);
  return `${safeSlug}-leads-${date}.csv`;
}

function safeSlugForFile(value = '') {
  return String(value || 'my-page').replace(/[^\w가-힣-]/g, '-') || 'my-page';
}

function csvFlatValue(value) {
  if (Array.isArray(value)) return value.map(csvFlatValue).join(', ');
  if (value && typeof value === 'object') return Object.values(value).map(csvFlatValue).filter(Boolean).join(' ');
  return String(value || '');
}

function csvFieldByCleanLabel(lead = {}, patterns = []) {
  const values = lead.values || {};
  for (const [key, value] of Object.entries(values)) {
    if (patterns.some((pattern) => pattern.test(String(key)))) return csvFlatValue(value);
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    if (patterns.some((pattern) => pattern.test(String(answer.label || answer.id || '')))) return csvFlatValue(answer.value);
  }
  return '';
}

function csvDeliveryLogsExport(logs = []) {
  return (Array.isArray(logs) ? logs : [])
    .slice(-10)
    .map((log) => [
      log.target,
      log.status,
      log.message,
      log.idempotencyKey ? `idempotency=${log.idempotencyKey}` : '',
      log.at,
    ].filter(Boolean).join(': '))
    .join(' / ');
}

function csvAnswersExport(answers = []) {
  return (Array.isArray(answers) ? answers : [])
    .map((answer) => `${answer.label || answer.id || '항목'}: ${csvFlatValue(answer.value)}`)
    .filter(Boolean)
    .join(' / ');
}

function csvValuesExport(values = {}) {
  return Object.entries(values || {})
    .map(([key, value]) => `${key}: ${csvFlatValue(value)}`)
    .filter(Boolean)
    .join(' / ');
}

function deliveryStatusExportText(status = 'none') {
  return {
    pending: '전송중',
    success: '전송완료',
    failed: '전송실패',
    partial: '일부실패',
    none: '미연결',
  }[status] || '미연결';
}

function leadsToCsvExport(leads = []) {
  const headers = [
    '접수ID',
    '접수유형',
    '상태',
    '접수시간',
    '이름',
    '대표연락처',
    '연락처',
    '이메일',
    '주소',
    '문의내용',
    '예약일',
    '예약시간',
    '메모',
    '외부 전송상태',
    '외부 전송요약',
    '외부 전송로그',
    '답변',
    '입력값',
  ];
  const rows = leads.map((lead) => [
    lead.id || '',
    lead.type || '',
    lead.status || '',
    formatCsvDate(lead.createdAt),
    lead.name || '',
    lead.phone || lead.email || lead.address || '',
    lead.phone || '',
    lead.email || '',
    lead.address || '',
    lead.message || '',
    csvFieldByCleanLabel(lead, [/예약일|예약날짜|date/i]),
    csvFieldByCleanLabel(lead, [/예약시간|시간|time/i]),
    lead.memo || '',
    deliveryStatusExportText(lead.delivery?.status),
    lead.delivery?.summary || '',
    csvDeliveryLogsExport(lead.delivery?.logs),
    csvAnswersExport(lead.answers),
    csvValuesExport(lead.values),
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function startDeliveryRetryWorker() {
  if (!deliveryRetryConfig.enabled) return;
  setInterval(() => {
    runDeliveryRetryWorker().catch((error) => {
      console.warn('Delivery retry worker failed:', error);
    });
  }, deliveryRetryConfig.intervalMs).unref?.();
}

async function runDeliveryRetryWorker() {
  if (deliveryRetryRunning) return;
  deliveryRetryRunning = true;
  try {
    const files = await leadStorageTargets();
    for (const target of files) {
      await retryFailedLeadsInFile(target.file, target.project);
    }
  } finally {
    deliveryRetryRunning = false;
  }
}

async function leadStorageTargets() {
  const targets = [];
  if (existsSync(leadsFile)) targets.push({ file: leadsFile, project: {} });

  const projectsDir = path.join(dataDir, 'projects');
  let entries = [];
  try {
    entries = await readdir(projectsDir, { withFileTypes: true });
  } catch {
    return targets;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectId = safeId(entry.name, '');
    if (!projectId) continue;
    const file = path.join(projectsDir, projectId, 'leads.jsonl');
    if (existsSync(file)) targets.push({ file, project: normalizeProject({ projectId, ownerId: 'local-user' }) });
  }
  return targets;
}

async function retryFailedLeadsInFile(file, project = {}) {
  return withFileLock(file, async () => {
  const leads = await readLeadListFromFile(file);
  let changed = false;

  for (let i = 0; i < leads.length; i += 1) {
    if (!shouldAutoRetryLead(leads[i])) continue;
    const deliveryPage = deliveryPageFrom(leads[i].deliveryPage || leads[i].page || {});
    const delivery = await sendServerLeadIntegrations(leads[i], deliveryPage);
    const previousRetry = leads[i].delivery?.retry || {};
    const attempts = Number(previousRetry.attempts || 0) + 1;
    const deadLetter = delivery.status !== 'success' && attempts >= deliveryRetryConfig.maxAttempts;
    leads[i] = {
      ...leads[i],
      delivery: {
        ...delivery,
        retry: {
          automatic: true,
          attempts,
          maxAttempts: deliveryRetryConfig.maxAttempts,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt: delivery.status === 'success' || attempts >= deliveryRetryConfig.maxAttempts
            ? ''
            : new Date(Date.now() + deliveryRetryConfig.intervalMs).toISOString(),
          ...(deadLetter ? { deadLetter: true, deadLetterAt: new Date().toISOString() } : {}),
        },
      },
      deliveryPage,
      updatedAt: new Date().toISOString(),
    };
    changed = true;
  }

  if (changed) await writeLeadListToFile(file, leads);
  });
}

function shouldAutoRetryLead(lead = {}) {
  if (!['failed', 'partial'].includes(lead.delivery?.status)) return false;
  const retry = lead.delivery?.retry || {};
  if (Number(retry.attempts || 0) >= deliveryRetryConfig.maxAttempts) return false;
  if (retry.nextRetryAt && Date.parse(retry.nextRetryAt) > Date.now()) return false;
  const page = deliveryPageFrom(lead.deliveryPage || lead.page || {});
  return !!buildServerIntegrationJobs(page.integrations || {}, lead, page).length;
}

async function readLeadListFromFile(file) {
  const parsed = await readJsonlFile(file);
  return parsed.records;
}

async function writeLeadListToFile(file, leads) {
  await mkdir(path.dirname(file), { recursive: true });
  await backupJsonlFile(file, 'leads-rewrite');
  await writeJsonlRecords(file, leads);
}

function isValidHttpUrl(value = '') {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function serviceLabel(key = '') {
  return {
    custom: '직접',
    crm: 'CRM',
    server: '서버',
    make: 'Make',
    zapier: 'Zapier',
    n8n: 'n8n',
  }[key] || key;
}

function safeId(value = '', fallback = 'local') {
  return String(value || fallback).replace(/[^a-zA-Z0-9-_]/g, '') || fallback;
}

function safeSlug(slug = '') {
  return safeId(slug, 'my-page');
}

function normalizeProject(project = {}) {
  const ownerId = safeId(project.ownerId, 'local-user');
  const projectId = safeId(project.projectId, `${ownerId}-my-page`);
  const slug = safeSlug(project.slug || 'my-page');
  return { ownerId, projectId, slug };
}

function hasProject(project = {}) {
  return !!(project.projectId || project.ownerId);
}

function projectFromQuery(url) {
  const projectId = url.searchParams.get('projectId') || '';
  const ownerId = url.searchParams.get('ownerId') || '';
  if (!projectId && !ownerId) return {};
  return normalizeProject({ projectId, ownerId, slug: url.searchParams.get('slug') || 'my-page' });
}

function projectDir(project = {}) {
  if (!project.projectId && !project.ownerId) return '';
  const normalized = normalizeProject(project);
  return path.join(dataDir, 'projects', normalized.projectId);
}

function projectAccessFile(project = {}) {
  const dir = projectDir(project);
  return dir ? path.join(dir, 'access.json') : '';
}

async function readProjectAccess(project = {}) {
  const file = projectAccessFile(project);
  if (!file) return null;
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    if (storageRuntime.active === 'd1' && hasProject(project)) {
      return getD1ProjectAccess(storageRuntime.d1, {
        projectId: normalizeProject(project).projectId,
      });
    }
    return null;
  }
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82') && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function ownerIdForEmail(email = '') {
  const normalized = normalizeEmail(email);
  return normalized ? safeId(`user_${stableHash(normalized)}`, '') : '';
}

function authUserPublic(user = {}) {
  return {
    id: user.id || '',
    ownerId: user.ownerId || '',
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
  };
}

function passwordHash(password = '', email = '') {
  const secret = sessionAuthConfig.secret || apiAuthConfig.token || 'inlet-local-auth-secret';
  return createHmac('sha256', secret).update(`${normalizeEmail(email)}:${String(password || '')}`).digest('hex');
}

function isValidPassword(password = '') {
  const value = String(password || '');
  return value.length >= 6 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

async function readUserAccounts() {
  try {
    return (await readJsonlRecords(usersFile)).records.filter((user) => user && typeof user === 'object');
  } catch {
    return [];
  }
}

async function readEmailVerifications() {
  try {
    return (await readJsonlRecords(emailVerificationsFile)).records.filter((record) => record && typeof record === 'object');
  } catch {
    return [];
  }
}

function publicEmailVerification(record = {}) {
  return {
    email: normalizeEmail(record.email || ''),
    purpose: String(record.purpose || 'signup'),
    status: record.status || 'pending',
    expiresAt: record.expiresAt || '',
    delivery: 'mock',
    ...(record.token ? { token: record.token } : {}),
  };
}

async function issueEmailVerification(emailInput = '', purposeInput = 'signup') {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  const now = new Date().toISOString();
  const record = {
    id: randomBytes(12).toString('base64url'),
    email,
    purpose: String(purposeInput || 'signup').trim() || 'signup',
    token: randomBytes(18).toString('base64url'),
    status: 'pending',
    createdAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
  };
  await appendJsonlRecord(emailVerificationsFile, record);
  return publicEmailVerification(record);
}

async function confirmEmailVerification(input = {}) {
  const email = normalizeEmail(input.email || '');
  const token = String(input.token || '').trim();
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  if (!token) {
    const error = new Error('Email verification token is required.');
    error.status = 400;
    error.details = { code: 'EMAIL_VERIFICATION_TOKEN_REQUIRED' };
    throw error;
  }
  return withFileLock(emailVerificationsFile, async () => {
    const records = await readEmailVerifications();
    const index = records.findIndex((record) => normalizeEmail(record.email) === email && String(record.token || '') === token);
    if (index < 0) {
      const error = new Error('Email verification token is invalid.');
      error.status = 403;
      error.details = { code: 'EMAIL_VERIFICATION_INVALID' };
      throw error;
    }
    const current = records[index];
    if (current.expiresAt && Date.parse(current.expiresAt) < Date.now()) {
      const nextExpired = { ...current, status: 'expired', confirmedAt: '' };
      const nextRecords = records.slice();
      nextRecords[index] = nextExpired;
      await writeJsonlRecords(emailVerificationsFile, nextRecords);
      const error = new Error('Email verification token has expired.');
      error.status = 410;
      error.details = { code: 'EMAIL_VERIFICATION_EXPIRED' };
      throw error;
    }
    const confirmed = { ...current, status: 'confirmed', confirmedAt: new Date().toISOString() };
    const nextRecords = records.slice();
    nextRecords[index] = confirmed;
    await writeJsonlRecords(emailVerificationsFile, nextRecords);
    return publicEmailVerification({ ...confirmed, token: '' });
  });
}

async function hasConfirmedEmailVerification(email = '') {
  const records = await readEmailVerifications();
  return records.some((record) => normalizeEmail(record.email) === normalizeEmail(email)
    && record.status === 'confirmed'
    && (!record.expiresAt || Date.parse(record.expiresAt) >= Date.now()));
}

async function registerUserAccount(input = {}, options = {}) {
  const email = normalizeEmail(input.email || '');
  const phone = normalizePhone(input.phone || '');
  const name = String(input.name || '').trim();
  const password = String(input.password || '');
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  if (!phone) {
    const error = new Error('Phone number is required.');
    error.status = 400;
    error.details = { code: 'AUTH_PHONE_REQUIRED' };
    throw error;
  }
  if (!isValidPassword(password)) {
    const error = new Error('Password must include letters and numbers and be at least 6 characters.');
    error.status = 400;
    error.details = { code: 'AUTH_PASSWORD_POLICY' };
    throw error;
  }
  const verified = input.emailVerified === true || await hasConfirmedEmailVerification(email);
  if (!verified) {
    const error = new Error('Email verification is required before signup.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
    throw error;
  }

  if (storageRuntime.active === 'd1') {
    const duplicateEmail = await getD1AccountByEmail(storageRuntime.d1, email);
    if (duplicateEmail) {
      const error = new Error('Email is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' };
      throw error;
    }
    const duplicatePhone = await getD1AccountByPhone(storageRuntime.d1, phone);
    if (duplicatePhone) {
      const error = new Error('Phone number is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' };
      throw error;
    }
    const now = new Date().toISOString();
    const user = await upsertD1Account(storageRuntime.d1, {
      id: safeId(input.id || ownerIdForEmail(email), ownerIdForEmail(email)),
      ownerId: ownerIdForEmail(email),
      name: name || email,
      email,
      phone,
      phoneVerified: false,
      emailVerified: true,
      passwordHash: password ? passwordHash(password, email) : '',
      source: String(options.source || input.source || 'signup'),
      createdAt: now,
      updatedAt: now,
    });
    return authUserPublic(user);
  }

  return withFileLock(usersFile, async () => {
    const users = await readUserAccounts();
    const duplicateEmail = users.find((user) => normalizeEmail(user.email) === email);
    if (duplicateEmail) {
      const error = new Error('Email is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' };
      throw error;
    }
    const duplicatePhone = users.find((user) => normalizePhone(user.phone) === phone);
    if (duplicatePhone) {
      const error = new Error('Phone number is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' };
      throw error;
    }
    const now = new Date().toISOString();
    const user = {
      id: safeId(input.id || ownerIdForEmail(email), ownerIdForEmail(email)),
      ownerId: ownerIdForEmail(email),
      name: name || email,
      email,
      phone,
      phoneVerified: false,
      emailVerified: true,
      passwordHash: password ? passwordHash(password, email) : '',
      source: String(options.source || input.source || 'signup'),
      createdAt: now,
      updatedAt: now,
    };
    await appendJsonlRecord(usersFile, user);
    return authUserPublic(user);
  });
}

async function loginUserAccount(input = {}) {
  const email = normalizeEmail(input.email || '');
  const password = String(input.password || '');
  if (!isValidEmail(email) || !password) {
    const error = new Error('Email and password are required.');
    error.status = 400;
    error.details = { code: 'AUTH_LOGIN_REQUIRED' };
    throw error;
  }
  const users = storageRuntime.active === 'd1' ? [] : await readUserAccounts();
  const user = storageRuntime.active === 'd1'
    ? await getD1AccountByEmail(storageRuntime.d1, email)
    : users.find((item) => normalizeEmail(item.email) === email);
  if (!user || user.passwordHash !== passwordHash(password, email)) {
    const error = new Error('Email or password is invalid.');
    error.status = 401;
    error.details = { code: 'AUTH_LOGIN_INVALID' };
    throw error;
  }
  if (user.emailVerified !== true) {
    const error = new Error('Email verification is required before login.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
    throw error;
  }
  const publicUser = authUserPublic(user);
  return {
    user: publicUser,
    session: createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: safeId(input.projectId || '', ''),
      role: input.role || 'master',
      email: publicUser.email,
    }),
  };
}

async function refreshUserSession(req, input = {}) {
  const token = sessionTokenFromRequest(req, input);
  const payload = verifySessionToken(token);
  if (!payload) {
    const error = new Error('Session is invalid or expired.');
    error.status = 401;
    error.details = { code: 'AUTH_SESSION_INVALID' };
    throw error;
  }
  const email = normalizeEmail(payload.email || input.email || '');
  const ownerId = safeId(payload.ownerId || '', '');
  const users = storageRuntime.active === 'd1' ? [] : await readUserAccounts();
  const user = storageRuntime.active === 'd1'
    ? (email ? await getD1AccountByEmail(storageRuntime.d1, email) : null)
    : users.find((item) => (email && normalizeEmail(item.email) === email) || (ownerId && safeId(item.ownerId || item.id, '') === ownerId));
  if (!user) {
    const error = new Error('Session account was not found.');
    error.status = 404;
    error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
    throw error;
  }
  if (user.emailVerified !== true) {
    const error = new Error('Email verification is required before session refresh.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
    throw error;
  }
  const publicUser = authUserPublic(user);
  const nextProjectId = safeId(input.projectId || payload.projectId || '', '');
  return {
    user: publicUser,
    session: createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: nextProjectId,
      role: payload.role || input.role || 'master',
      email: publicUser.email,
    }),
    expiresInSeconds: 60 * 60 * 24 * 30,
  };
}

async function updateUserAccount(req, input = {}) {
  const token = sessionTokenFromRequest(req, input);
  const payload = verifySessionToken(token);
  if (!payload) {
    const error = new Error('Session is invalid or expired.');
    error.status = 401;
    error.details = { code: 'AUTH_SESSION_INVALID' };
    throw error;
  }
  const email = normalizeEmail(payload.email || input.email || '');
  const ownerId = safeId(payload.ownerId || '', '');
  const name = String(input.name || '').trim();
  const phone = normalizePhone(input.phone || '');
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  if (!phone) {
    const error = new Error('Phone number is required.');
    error.status = 400;
    error.details = { code: 'AUTH_PHONE_REQUIRED' };
    throw error;
  }

  if (storageRuntime.active === 'd1') {
    const current = await getD1AccountByEmail(storageRuntime.d1, email);
    if (!current || (ownerId && safeId(current.ownerId || current.id, '') !== ownerId)) {
      const error = new Error('Session account was not found.');
      error.status = 404;
      error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
      throw error;
    }
    const duplicatePhone = await getD1AccountByPhone(storageRuntime.d1, phone);
    if (duplicatePhone && normalizeEmail(duplicatePhone.email) !== email) {
      const error = new Error('Phone number is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' };
      throw error;
    }
    const updated = await upsertD1Account(storageRuntime.d1, {
      ...current,
      name: name || current.name || email,
      phone,
      updatedAt: new Date().toISOString(),
    });
    const publicUser = authUserPublic(updated);
    return {
      user: publicUser,
      session: createSessionToken({
        ownerId: publicUser.ownerId,
        projectId: safeId(input.projectId || payload.projectId || '', ''),
        role: payload.role || input.role || 'master',
        email: publicUser.email,
      }),
    };
  }

  return withFileLock(usersFile, async () => {
    const users = await readUserAccounts();
    const index = users.findIndex((user) => normalizeEmail(user.email) === email || (ownerId && safeId(user.ownerId || user.id, '') === ownerId));
    if (index < 0) {
      const error = new Error('Account not found.');
      error.status = 404;
      error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
      throw error;
    }
    const duplicatePhone = users.find((user, currentIndex) => currentIndex !== index && normalizePhone(user.phone) === phone);
    if (duplicatePhone) {
      const error = new Error('Phone number is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_PHONE_DUPLICATE', field: 'phone' };
      throw error;
    }
    const nextUser = {
      ...users[index],
      name: name || users[index].name || email,
      phone,
      updatedAt: new Date().toISOString(),
    };
    const nextUsers = users.slice();
    nextUsers[index] = nextUser;
    await writeJsonlRecords(usersFile, nextUsers);
    const publicUser = authUserPublic(nextUser);
    return {
      user: publicUser,
      session: createSessionToken({
        ownerId: publicUser.ownerId,
        projectId: safeId(input.projectId || payload.projectId || '', ''),
        role: payload.role || input.role || 'master',
        email: publicUser.email,
      }),
    };
  });
}

async function changeUserPassword(input = {}) {
  const email = normalizeEmail(input.email || '');
  const password = String(input.password || '');
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  if (input.emailVerified !== true) {
    const error = new Error('Email verification is required before changing password.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
    throw error;
  }
  if (!isValidPassword(password)) {
    const error = new Error('Password must include letters and numbers and be at least 6 characters.');
    error.status = 400;
    error.details = { code: 'AUTH_PASSWORD_POLICY' };
    throw error;
  }
  if (storageRuntime.active === 'd1') {
    const user = await getD1AccountByEmail(storageRuntime.d1, email);
    if (!user) {
      const error = new Error('Account was not found.');
      error.status = 404;
      error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
      throw error;
    }
    const updated = await upsertD1Account(storageRuntime.d1, {
      ...user,
      passwordHash: passwordHash(password, email),
      updatedAt: new Date().toISOString(),
    });
    return authUserPublic(updated);
  }

  return withFileLock(usersFile, async () => {
    const users = await readUserAccounts();
    const index = users.findIndex((user) => normalizeEmail(user.email) === email);
    if (index < 0) {
      const error = new Error('Account not found.');
      error.status = 404;
      error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
      throw error;
    }
    const nextUser = {
      ...users[index],
      passwordHash: passwordHash(password, email),
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    };
    const nextUsers = users.slice();
    nextUsers[index] = nextUser;
    await writeJsonlRecords(usersFile, nextUsers);
    return authUserPublic(nextUser);
  });
}

const managerPermissionTabs = ['edit', 'style', 'inbox', 'stats', 'settings'];

function normalizeManagerAccess(access = {}) {
  return managerPermissionTabs.reduce((next, tab) => {
    const current = access?.[tab] || {};
    next[tab] = {
      read: !!current.read || !!current.write,
      write: !!current.write,
    };
    return next;
  }, {});
}

function managersFromPage(page = {}) {
  const ownership = page?.ownership && typeof page.ownership === 'object' ? page.ownership : {};
  const managers = Array.isArray(ownership.managers) ? ownership.managers : [];
  return managers
    .map((manager) => {
      const email = normalizeEmail(manager?.email || '');
      const ownerId = ownerIdForEmail(email);
      if (!email || !ownerId) return null;
      return {
        id: safeId(manager?.id || ownerId, ownerId),
        name: String(manager?.name || '').trim(),
        email,
        ownerId,
        status: manager?.status === 'disabled' ? 'disabled' : 'active',
        access: normalizeManagerAccess(manager?.access || {}),
      };
    })
    .filter(Boolean);
}

function normalizeInvite(input = {}) {
  const email = normalizeEmail(input.email || '');
  const ownerId = ownerIdForEmail(email);
  return {
    id: safeId(input.id || ownerId || randomBytes(8).toString('hex'), randomBytes(8).toString('hex')),
    name: String(input.name || '').trim(),
    email,
    ownerId,
    status: input.status === 'accepted' || input.status === 'revoked' || input.status === 'expired' ? input.status : 'pending',
    access: normalizeManagerAccess(input.access || {}),
    invitedAt: input.invitedAt || new Date().toISOString(),
    acceptedAt: input.acceptedAt || '',
    expiresAt: input.expiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    token: String(input.token || '').trim(),
  };
}

function projectAccessFromPage(page = {}, project = {}) {
  const ownership = page?.ownership && typeof page.ownership === 'object' ? page.ownership : {};
  const normalizedProject = normalizeProject(project);
  const clientEmail = normalizeEmail(ownership.clientEmail || page.clientEmail || '');
  const clientOwnerId = ownership.clientAccess !== false ? ownerIdForEmail(clientEmail) : '';
  const managers = managersFromPage(page);
  return {
    projectId: normalizedProject.projectId,
    ownerId: normalizedProject.ownerId,
    ownerEmail: normalizeEmail(ownership.ownerEmail || page.ownerEmail || ''),
    clientEmail,
    clientAccess: ownership.clientAccess !== false,
    clientOwnerIds: clientOwnerId ? [clientOwnerId] : [],
    managerOwnerIds: managers.map((manager) => manager.ownerId),
    managers,
    invites: [],
    updatedAt: new Date().toISOString(),
  };
}

function managerAccessForIdentity(identity = {}, access = {}) {
  if (!identity.ownerId) return null;
  const managers = Array.isArray(access.managers) ? access.managers : [];
  return managers.find((manager) => manager.status !== 'disabled' && manager.ownerId === identity.ownerId) || null;
}

function canAccessProject(identity = {}, access = {}, options = {}) {
  if (!identity.ownerId) return false;
  if (identity.ownerId === safeId(access.ownerId, '')) return true;
  if (access.clientAccess && Array.isArray(access.clientOwnerIds) && access.clientOwnerIds.includes(identity.ownerId)) return true;
  const manager = managerAccessForIdentity(identity, access);
  if (!manager) return false;
  const tab = String(options.tab || '').trim();
  if (!tab) return true;
  const permission = manager.access?.[tab] || {};
  return options.write ? !!permission.write : !!(permission.read || permission.write);
}

async function writeProjectAccess(project = {}, access = {}) {
  const file = projectAccessFile(project);
  if (!file) return null;
  await mkdir(path.dirname(file), { recursive: true });
  const next = {
    ...access,
    projectId: normalizeProject(project).projectId,
    ownerId: safeId(access.ownerId, normalizeProject(project).ownerId),
    clientOwnerIds: Array.isArray(access.clientOwnerIds) ? access.clientOwnerIds.map((id) => safeId(id, '')).filter(Boolean) : [],
    managerOwnerIds: Array.isArray(access.managerOwnerIds) ? access.managerOwnerIds.map((id) => safeId(id, '')).filter(Boolean) : [],
    managers: Array.isArray(access.managers)
      ? access.managers.map((manager) => ({
        ...manager,
        ownerId: safeId(manager.ownerId || ownerIdForEmail(manager.email), ''),
        email: normalizeEmail(manager.email || ''),
        status: manager.status === 'disabled' ? 'disabled' : 'active',
        access: normalizeManagerAccess(manager.access || {}),
      })).filter((manager) => manager.ownerId && manager.email)
      : [],
    invites: Array.isArray(access.invites)
      ? access.invites.map(normalizeInvite).filter((invite) => invite.email && invite.ownerId && invite.token)
      : [],
    updatedAt: new Date().toISOString(),
  };
  await writeFile(file, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

async function authorizeProjectAccess(req, project = {}, options = {}) {
  if (!projectAuthConfig.enforce || !hasProject(project)) return hasProject(project) ? normalizeProject(project) : {};
  const normalizedProject = normalizeProject(project);
  const identity = requestIdentity(req);
  if (!identity.ownerId) throw accessError('Project owner identity is required.', 'PROJECT_ACCESS_REQUIRED');
  if (identity.projectId && identity.projectId !== normalizedProject.projectId) {
    throw accessError('Project identity does not match the requested project.', 'PROJECT_ACCESS_MISMATCH');
  }

  const access = await readProjectAccess(normalizedProject);
  if (access) {
    if (!canAccessProject(identity, access, options)) throw accessError(options.write ? 'Project write access denied.' : 'Project access denied.');
    return normalizedProject;
  }

  if (identity.ownerId !== normalizedProject.ownerId) {
    throw accessError('Project access has not been granted.');
  }

  if (options.write || options.bootstrap) {
    await writeProjectAccess(normalizedProject, projectAccessFromPage(options.page || {}, normalizedProject));
  }
  return normalizedProject;
}

async function assertProjectMaster(req, project = {}, action = 'manage project') {
  const normalizedProject = normalizeProject(project);
  const identity = requestIdentity(req);
  const access = await readProjectAccess(normalizedProject);
  const ownerId = safeId(access?.ownerId, normalizedProject.ownerId);
  if (!identity.ownerId || identity.ownerId !== ownerId) {
    throw accessError(`Only the project master can ${action}.`);
  }
  return true;
}

async function assertProjectAdmin(req, project = {}, action = 'manage project') {
  const normalizedProject = normalizeProject(project);
  const identity = requestIdentity(req);
  const access = await readProjectAccess(normalizedProject);
  const ownerId = safeId(access?.ownerId, normalizedProject.ownerId);
  const clientOwnerIds = Array.isArray(access?.clientOwnerIds) ? access.clientOwnerIds.map((id) => safeId(id, '')).filter(Boolean) : [];
  if (identity.ownerId && (identity.ownerId === ownerId || clientOwnerIds.includes(identity.ownerId))) return true;
  throw accessError(`Only the project master or client admin can ${action}.`);
}

async function updateProjectAccessFromPage(req, page = {}, project = {}) {
  if (!projectAuthConfig.enforce || !hasProject(project)) return null;
  const normalizedProject = normalizeProject(project);
  const identity = requestIdentity(req);
  const current = await readProjectAccess(normalizedProject);
  if (current) await assertProjectAdmin(req, normalizedProject, 'update project access');
  const next = projectAccessFromPage(page, normalizedProject);
  const previousClientOwnerIds = Array.isArray(current?.clientOwnerIds) ? current.clientOwnerIds : [];
  const previousManagerOwnerIds = Array.isArray(current?.managerOwnerIds) ? current.managerOwnerIds : [];
  const clientOwnerIds = [...new Set([...(next.clientOwnerIds || []), ...previousClientOwnerIds].filter(Boolean))];
  const managerOwnerIds = [...new Set([...(next.managerOwnerIds || []), ...previousManagerOwnerIds].filter(Boolean))];
  return writeProjectAccess(normalizedProject, { ...current, ...next, clientOwnerIds, managerOwnerIds });
}

function publicInvite(invite = {}) {
  return {
    id: invite.id,
    name: invite.name,
    email: invite.email,
    status: invite.status,
    access: invite.access,
    invitedAt: invite.invitedAt,
    acceptedAt: invite.acceptedAt || '',
    expiresAt: invite.expiresAt || '',
    project: invite.project || null,
  };
}

async function createManagerInvite(project = {}, manager = {}) {
  const normalizedProject = normalizeProject(project);
  const access = await readProjectAccess(normalizedProject);
  if (!access) throw accessError('Project access metadata is required before inviting managers.', 'PROJECT_ACCESS_REQUIRED');
  const invite = normalizeInvite({
    ...manager,
    token: randomBytes(24).toString('base64url'),
    status: 'pending',
  });
  if (!invite.email || !invite.ownerId) {
    const error = new Error('Manager email is required.');
    error.status = 400;
    throw error;
  }
  const invites = (Array.isArray(access.invites) ? access.invites : [])
    .map(normalizeInvite)
    .filter((item) => item.email !== invite.email && item.token !== invite.token);
  invites.push(invite);
  await writeProjectAccess(normalizedProject, { ...access, invites });
  await syncD1Invite(normalizedProject, invite, access);
  return {
    ...publicInvite({ ...invite, project: normalizedProject }),
    token: invite.token,
    acceptUrl: `/invite/${encodeURIComponent(invite.token)}`,
  };
}

async function syncD1Invite(project = {}, invite = {}, access = {}) {
  if (storageRuntime.active !== 'd1') return null;
  return upsertD1Invite(storageRuntime.d1, invite, {
    projectId: normalizeProject(project).projectId,
    ownerId: safeId(access.ownerId || normalizeProject(project).ownerId, ''),
    invitedByAccountId: safeId(access.ownerId || normalizeProject(project).ownerId, ''),
  });
}

async function syncD1ProjectMember(project = {}, manager = {}, access = {}) {
  if (storageRuntime.active !== 'd1') return null;
  return upsertD1ProjectMember(storageRuntime.d1, {
    id: manager.id,
    ownerId: manager.ownerId,
    role: 'manager',
    access: manager.access || {},
    status: manager.status === 'disabled' ? 'removed' : 'active',
    acceptedAt: manager.acceptedAt,
  }, {
    projectId: normalizeProject(project).projectId,
    accountId: manager.ownerId,
    invitedByAccountId: safeId(access.ownerId || normalizeProject(project).ownerId, ''),
  });
}

function publicOwnershipTransferRequest(request = {}, manager = {}) {
  return {
    id: request.id || '',
    projectId: request.projectId || '',
    managerId: manager.id || request.managerId || '',
    managerName: manager.name || request.managerName || '',
    managerEmail: manager.email || request.managerEmail || '',
    fromAccountId: request.fromAccountId || '',
    toAccountId: request.toAccountId || '',
    requestedByAccountId: request.requestedByAccountId || '',
    approvedByAccountId: request.approvedByAccountId || '',
    status: request.status || 'requested',
    billingClearanceStatus: request.billingClearanceStatus || 'not_checked',
    note: request.note || '',
    requestedAt: request.requestedAt || '',
    approvedAt: request.approvedAt || '',
    completedAt: request.completedAt || '',
    billingPolicy: '결제 중이면 만료 또는 해지 후 최종 승인됩니다. 이후 새 소유자 계정 카드로 결제할 수 있게 연결합니다.',
  };
}

async function createOwnershipTransferRequest(req, project = {}, input = {}) {
  const normalizedProject = normalizeProject(project);
  const access = await readProjectAccess(normalizedProject);
  if (!access) throw accessError('Project access metadata is required before ownership transfer.', 'PROJECT_ACCESS_REQUIRED');
  const managers = Array.isArray(access.managers) ? access.managers.map((manager) => ({
    ...manager,
    email: normalizeEmail(manager.email || ''),
    ownerId: safeId(manager.ownerId || ownerIdForEmail(manager.email), ''),
    status: manager.status === 'disabled' ? 'disabled' : 'active',
    access: normalizeManagerAccess(manager.access || {}),
  })) : [];
  const managerId = String(input.managerId || input.targetManagerId || input.id || '').trim();
  const managerEmail = normalizeEmail(input.managerEmail || input.email || '');
  const selected = managers.find((manager) => (
    manager.status !== 'disabled'
    && ((managerId && String(manager.id) === managerId) || (managerId && String(manager.ownerId) === managerId) || (managerEmail && manager.email === managerEmail))
  )) || null;
  if (!selected?.ownerId || !selected.email) {
    const error = new Error('Ownership transfer target must be an active manager.');
    error.status = 400;
    error.details = { code: 'OWNERSHIP_TRANSFER_MANAGER_REQUIRED' };
    throw error;
  }
  const identity = requestIdentity(req);
  const now = new Date().toISOString();
  const request = {
    id: safeId(input.id || `transfer-${Date.now()}-${randomBytes(4).toString('hex')}`, `transfer-${Date.now()}`),
    projectId: normalizedProject.projectId,
    managerId: selected.id || selected.ownerId,
    managerName: selected.name || '',
    managerEmail: selected.email,
    fromAccountId: safeId(access.ownerId || normalizedProject.ownerId, ''),
    toAccountId: selected.ownerId,
    requestedByAccountId: safeId(identity.ownerId || access.ownerId || normalizedProject.ownerId, ''),
    status: 'requested',
    billingClearanceStatus: 'not_checked',
    note: String(input.note || '').trim(),
    requestedAt: now,
  };
  if (storageRuntime.active === 'd1') {
    const saved = await upsertD1OwnershipTransferRequest(storageRuntime.d1, request, {
      projectId: request.projectId,
      fromAccountId: request.fromAccountId,
      toAccountId: request.toAccountId,
      requestedByAccountId: request.requestedByAccountId,
    });
    await writeProjectAccess(normalizedProject, { ...access, transferRequest: publicOwnershipTransferRequest(saved, selected) });
    return publicOwnershipTransferRequest(saved, selected);
  }
  const fallback = publicOwnershipTransferRequest(request, selected);
  const transferRequests = Array.isArray(access.transferRequests) ? access.transferRequests.filter((item) => item.id !== fallback.id) : [];
  transferRequests.unshift(fallback);
  await writeProjectAccess(normalizedProject, { ...access, transferRequest: fallback, transferRequests });
  return fallback;
}

async function listOwnershipTransferRequests(project = {}, filters = {}) {
  const normalizedProject = normalizeProject(project);
  if (storageRuntime.active === 'd1') {
    const page = await listD1OwnershipTransferRequests(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      status: filters.status || '',
      cursor: filters.cursor || 0,
      limit: filters.limit || 50,
    });
    return {
      requests: page.records.map((request) => publicOwnershipTransferRequest(request)),
      total: page.total,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      queryPlan: storageRuntimePlan(storageRuntime, 'ownership_transfer_requests', { projectId: normalizedProject.projectId, status: filters.status || '' }),
    };
  }
  const access = await readProjectAccess(normalizedProject);
  const requests = Array.isArray(access?.transferRequests)
    ? access.transferRequests
    : (access?.transferRequest ? [access.transferRequest] : []);
  const filtered = filters.status ? requests.filter((request) => request.status === filters.status) : requests;
  const cursor = Math.max(0, Number(filters.cursor || 0));
  const limit = Math.max(1, Math.min(100, Number(filters.limit || 50)));
  const page = filtered.slice(cursor, cursor + limit);
  return {
    requests: page,
    total: filtered.length,
    nextCursor: cursor + page.length < filtered.length ? cursor + page.length : null,
    hasMore: cursor + page.length < filtered.length,
    queryPlan: storageRuntimePlan(storageRuntime, 'ownership_transfer_requests', { projectId: normalizedProject.projectId, fallback: true }),
  };
}

function normalizeTransferStatus(value = '') {
  const status = String(value || '').trim();
  return ['requested', 'waiting_billing_clearance', 'approved', 'rejected', 'completed', 'canceled'].includes(status) ? status : '';
}

function normalizeBillingClearanceStatus(value = '') {
  const status = String(value || '').trim();
  return ['not_checked', 'clear', 'active_subscription', 'past_due'].includes(status) ? status : '';
}

async function applyOwnershipTransferCompletion(project = {}, request = {}, access = {}, now = new Date().toISOString()) {
  const normalizedProject = normalizeProject(project);
  const toAccountId = safeId(request.toAccountId || '', '');
  const fromAccountId = safeId(request.fromAccountId || access.ownerId || normalizedProject.ownerId, '');
  const managerEmail = normalizeEmail(request.managerEmail || '');
  if (!toAccountId || !managerEmail) {
    const error = new Error('Ownership transfer target account is missing.');
    error.status = 400;
    error.details = { code: 'OWNERSHIP_TRANSFER_TARGET_REQUIRED' };
    throw error;
  }

  const managers = (Array.isArray(access.managers) ? access.managers : [])
    .map((manager) => ({
      ...manager,
      email: normalizeEmail(manager.email || ''),
      ownerId: safeId(manager.ownerId || ownerIdForEmail(manager.email), ''),
      status: manager.status === 'disabled' ? 'disabled' : 'active',
      access: normalizeManagerAccess(manager.access || {}),
    }))
    .filter((manager) => manager.ownerId && manager.email && manager.ownerId !== toAccountId && manager.email !== managerEmail);

  const nextAccess = await writeProjectAccess(normalizedProject, {
    ...access,
    ownerId: toAccountId,
    ownerEmail: managerEmail,
    clientEmail: '',
    clientAccess: false,
    clientOwnerIds: [],
    managerOwnerIds: managers.map((manager) => manager.ownerId),
    managers,
    transferredAt: now,
  });

  if (storageRuntime.active === 'd1') {
    await storageRuntime.d1.prepare(`
      UPDATE projects
      SET owner_account_id = ?, client_email = '', billing_status = CASE
        WHEN billing_status = 'transfer_pending' THEN 'trial'
        ELSE billing_status
      END, updated_at = ?
      WHERE id = ?
    `).bind(toAccountId, now, normalizedProject.projectId).run();
    await upsertD1ProjectMember(storageRuntime.d1, {
      id: `${normalizedProject.projectId}-${toAccountId}-master`,
      ownerId: toAccountId,
      role: 'master',
      access: {},
      status: 'active',
      acceptedAt: now,
      updatedAt: now,
    }, {
      projectId: normalizedProject.projectId,
      accountId: toAccountId,
      invitedByAccountId: fromAccountId || null,
    });
    if (fromAccountId && fromAccountId !== toAccountId) {
      await storageRuntime.d1.prepare(`
        UPDATE project_members
        SET status = 'removed', updated_at = ?
        WHERE project_id = ? AND account_id = ? AND role IN ('master', 'client_admin')
      `).bind(now, normalizedProject.projectId, fromAccountId).run();
    }
    await storageRuntime.d1.prepare(`
      UPDATE project_members
      SET status = 'removed', updated_at = ?
      WHERE project_id = ? AND account_id = ? AND role = 'manager'
    `).bind(now, normalizedProject.projectId, toAccountId).run();
  }

  const currentPage = await readPage(normalizedProject.slug || 'my-page', normalizedProject);
  if (currentPage) {
    await savePage(currentPage.slug || normalizedProject.slug || 'my-page', {
      ...currentPage,
      ownerId: toAccountId,
      ownership: {
        ...(currentPage.ownership || {}),
        ownerEmail: managerEmail,
        clientEmail: '',
        clientAccess: false,
        transferredAt: now,
        transferRequest: {
          ...(currentPage.ownership?.transferRequest || {}),
          ...publicOwnershipTransferRequest({ ...request, status: 'completed', completedAt: now }),
        },
        managers,
      },
      revisionReason: 'ownership-transfer-completed',
    }, { ...normalizedProject, ownerId: toAccountId }, {
      reason: 'ownership-transfer-completed',
      createdByAccountId: fromAccountId,
    });
  }

  return nextAccess;
}

async function updateOwnershipTransferRequest(req, project = {}, id = '', input = {}) {
  const normalizedProject = normalizeProject(project);
  const requestId = safeId(id, '');
  const status = normalizeTransferStatus(input.status || input.request?.status);
  if (!requestId || !status || status === 'requested') {
    const error = new Error('Valid ownership transfer status is required.');
    error.status = 400;
    error.details = { code: 'OWNERSHIP_TRANSFER_STATUS_REQUIRED' };
    throw error;
  }
  const identity = requestIdentity(req);
  const now = new Date().toISOString();
  const billingClearanceInput = normalizeBillingClearanceStatus(input.billingClearanceStatus || input.billing_clearance_status);
  const billingClearanceStatus = billingClearanceInput || (status === 'waiting_billing_clearance' ? 'active_subscription' : 'not_checked');

  if (storageRuntime.active === 'd1') {
    const page = await listD1OwnershipTransferRequests(storageRuntime.d1, { projectId: normalizedProject.projectId, limit: 100 });
    const current = page.records.find((request) => request.id === requestId);
    if (!current) {
      const error = new Error('Ownership transfer request not found.');
      error.status = 404;
      throw error;
    }
    const effectiveBillingClearanceStatus = billingClearanceInput || current.billingClearanceStatus || billingClearanceStatus;
    if (status === 'completed' && effectiveBillingClearanceStatus !== 'clear') {
      const error = new Error('Ownership transfer cannot complete until billing is clear.');
      error.status = 409;
      error.details = { code: 'OWNERSHIP_TRANSFER_BILLING_NOT_CLEAR' };
      throw error;
    }
    const access = await readProjectAccess(normalizedProject);
    if (!access) throw accessError('Project access metadata is required before ownership transfer.', 'PROJECT_ACCESS_REQUIRED');
    const saved = await upsertD1OwnershipTransferRequest(storageRuntime.d1, {
      ...current,
      status,
      billingClearanceStatus: effectiveBillingClearanceStatus,
      note: String(input.note || current.note || ''),
      approvedByAccountId: safeId(identity.ownerId || '', ''),
      approvedAt: ['approved', 'rejected', 'waiting_billing_clearance'].includes(status) ? now : current.approvedAt,
      completedAt: status === 'completed' ? now : current.completedAt,
    }, {
      projectId: normalizedProject.projectId,
      fromAccountId: current.fromAccountId,
      toAccountId: current.toAccountId,
      requestedByAccountId: current.requestedByAccountId,
    });
    if (status === 'completed') {
      await applyOwnershipTransferCompletion(normalizedProject, saved, access, now);
    }
    await insertD1AuditLog(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      actorAccountId: safeId(identity.ownerId || '', ''),
      action: `ownership_transfer.${status}`,
      targetType: 'ownership_transfer_request',
      targetId: requestId,
      metadata: { billingClearanceStatus: effectiveBillingClearanceStatus, note: input.note || '' },
    });
    return publicOwnershipTransferRequest(saved);
  }

  const access = await readProjectAccess(normalizedProject);
  if (!access) throw accessError('Project access metadata is required before ownership transfer.', 'PROJECT_ACCESS_REQUIRED');
  const requests = Array.isArray(access.transferRequests)
    ? access.transferRequests
    : (access.transferRequest ? [access.transferRequest] : []);
  const index = requests.findIndex((request) => request.id === requestId);
  if (index < 0) {
    const error = new Error('Ownership transfer request not found.');
    error.status = 404;
    throw error;
  }
  const effectiveBillingClearanceStatus = billingClearanceInput || requests[index].billingClearanceStatus || billingClearanceStatus;
  if (status === 'completed' && effectiveBillingClearanceStatus !== 'clear') {
    const error = new Error('Ownership transfer cannot complete until billing is clear.');
    error.status = 409;
    error.details = { code: 'OWNERSHIP_TRANSFER_BILLING_NOT_CLEAR' };
    throw error;
  }
  const nextRequest = {
    ...requests[index],
    status,
    billingClearanceStatus: effectiveBillingClearanceStatus,
    note: String(input.note || requests[index].note || ''),
    approvedByAccountId: safeId(identity.ownerId || '', ''),
    approvedAt: ['approved', 'rejected', 'waiting_billing_clearance'].includes(status) ? now : requests[index].approvedAt,
    completedAt: status === 'completed' ? now : requests[index].completedAt,
  };
  const nextRequests = requests.slice();
  nextRequests[index] = nextRequest;
  await writeProjectAccess(normalizedProject, { ...access, transferRequest: nextRequest, transferRequests: nextRequests });
  if (status === 'completed') {
    await applyOwnershipTransferCompletion(normalizedProject, nextRequest, { ...access, transferRequest: nextRequest, transferRequests: nextRequests }, now);
  }
  return publicOwnershipTransferRequest(nextRequest);
}

async function allProjectAccessEntries() {
  const projectsRoot = path.join(dataDir, 'projects');
  let entries = [];
  try {
    entries = await readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const project = normalizeProject({ projectId: entry.name, ownerId: 'local-user' });
    const access = await readProjectAccess(project);
    if (access?.projectId) result.push({ project: normalizeProject({ projectId: access.projectId, ownerId: access.ownerId, slug: access.slug || 'my-page' }), access });
  }
  return result;
}

async function readManagerInvite(token = '') {
  const safeToken = String(token || '').trim();
  if (!safeToken) return null;
  const entries = await allProjectAccessEntries();
  for (const entry of entries) {
    const invite = (Array.isArray(entry.access.invites) ? entry.access.invites : [])
      .map(normalizeInvite)
      .find((item) => item.token === safeToken);
    if (invite) return { ...invite, project: normalizeProject({ projectId: entry.access.projectId, ownerId: entry.access.ownerId, slug: entry.access.slug || 'my-page' }) };
  }
  return null;
}

async function acceptManagerInvite(token = '', body = {}) {
  const safeToken = String(token || '').trim();
  const entries = await allProjectAccessEntries();
  for (const entry of entries) {
    const invites = (Array.isArray(entry.access.invites) ? entry.access.invites : []).map(normalizeInvite);
    const inviteIndex = invites.findIndex((item) => item.token === safeToken);
    if (inviteIndex < 0) continue;
    const invite = invites[inviteIndex];
    if (invite.status !== 'pending') {
      const error = new Error('Invite is not pending.');
      error.status = 409;
      throw error;
    }
    if (invite.expiresAt && Date.parse(invite.expiresAt) < Date.now()) {
      invites[inviteIndex] = { ...invite, status: 'expired' };
      await writeProjectAccess(entry.project, { ...entry.access, invites });
      const error = new Error('Invite has expired.');
      error.status = 410;
      throw error;
    }
    const email = normalizeEmail(body.email || invite.email);
    if (email !== invite.email) {
      const error = new Error('Invite email does not match.');
      error.status = 403;
      error.details = { code: 'INVITE_EMAIL_MISMATCH' };
      throw error;
    }
    if (String(body.authMode || '').toLowerCase() === 'signup' && body.emailVerified !== true) {
      const error = new Error('Email verification is required before signup.');
      error.status = 403;
      error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
      throw error;
    }
    if (String(body.authMode || '').toLowerCase() === 'signup') {
      await registerUserAccount({
        name: body.name || invite.name || email,
        email,
        phone: body.phone || '',
        password: body.password || '',
        emailVerified: true,
        source: 'manager-invite',
      }, { source: 'manager-invite' });
    } else {
      await loginUserAccount({
        email,
        password: body.password || '',
        projectId: entry.access.projectId,
        role: 'manager',
      });
    }
    const accepted = {
      id: invite.id,
      name: String(body.name || invite.name || email).trim(),
      email,
      phone: normalizePhone(body.phone || ''),
      ownerId: invite.ownerId,
      status: 'active',
      invitedAt: invite.invitedAt,
      acceptedAt: new Date().toISOString(),
      access: normalizeManagerAccess(invite.access || {}),
    };
    const managers = (Array.isArray(entry.access.managers) ? entry.access.managers : [])
      .filter((manager) => normalizeEmail(manager.email) !== email && safeId(manager.ownerId, '') !== invite.ownerId);
    managers.push(accepted);
    invites[inviteIndex] = { ...invite, status: 'accepted', acceptedAt: accepted.acceptedAt };
    const project = normalizeProject({ projectId: entry.access.projectId, ownerId: entry.access.ownerId, slug: entry.access.slug || 'my-page' });
    await writeProjectAccess(project, {
      ...entry.access,
      managers,
      managerOwnerIds: [...new Set([...(entry.access.managerOwnerIds || []), invite.ownerId].filter(Boolean))],
      invites,
    });
    await syncD1Invite(project, invites[inviteIndex], entry.access);
    await syncD1ProjectMember(project, accepted, entry.access);
    return {
      invite: publicInvite({ ...invites[inviteIndex], project }),
      manager: accepted,
      project,
      session: createSessionToken({
        ownerId: accepted.ownerId,
        projectId: project.projectId,
        role: 'manager',
        email: accepted.email,
      }),
    };
  }
  const error = new Error('Invite not found.');
  error.status = 404;
  throw error;
}

function projectLeadsFile(project = {}) {
  const dir = projectDir(project);
  return dir ? path.join(dir, 'leads.jsonl') : '';
}

function projectEventsFile(project = {}) {
  const dir = projectDir(project);
  return dir ? path.join(dir, 'events.jsonl') : '';
}

function aiDraftsFile(project = {}) {
  const dir = projectDir(project);
  return dir ? path.join(dir, 'ai-drafts.json') : path.join(dataDir, 'ai-drafts.json');
}

function projectPageFile(slug, project = {}) {
  const dir = projectDir(project);
  return dir ? path.join(dir, 'pages', `${safeSlug(slug)}.json`) : '';
}

function pageRevisionDir(slug, project = {}) {
  const scopedPage = projectPageFile(slug, project);
  if (scopedPage) return path.join(path.dirname(scopedPage), `${safeSlug(slug)}.revisions`);
  return path.join(pagesDir, `${safeSlug(slug)}.revisions`);
}

function pageFile(slug, project = {}) {
  const scoped = projectPageFile(slug, project);
  if (scoped) return scoped;
  return path.join(pagesDir, `${safeSlug(slug)}.json`);
}

async function readPage(slug, project = {}) {
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    return getD1PageBySlug(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      slug: safeSlug(slug),
    });
  }
  try {
    const raw = await readFile(pageFile(slug, project), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readMapEmbedData(siteId = '') {
  const safeSiteId = safeId(siteId, '');
  if (!safeSiteId) return null;

  const projectPagesDir = path.join(dataDir, 'projects', safeSiteId, 'pages');
  const projectPage = await readFirstPageFromDir(projectPagesDir);
  const page = projectPage || await readPage(safeSiteId, {});
  if (!page) return null;

  const mapBlock = (Array.isArray(page.blocks) ? page.blocks : []).find((block) => block?.type === 'map' && block.visible !== false);
  if (!mapBlock) return null;
  return sanitizeMapEmbedData(mapBlock.s || {}, page, safeSiteId);
}

async function readFirstPageFromDir(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  for (const file of files) {
    try {
      return JSON.parse(await readFile(path.join(dir, file), 'utf8'));
    } catch {}
  }

  return null;
}

function sanitizeMapEmbedData(settings = {}, page = {}, siteId = '') {
  const placeName = String(settings.placeName || settings.title || page.title || '오시는 길').trim();
  return {
    siteId,
    placeName,
    address: String(settings.address || '').trim(),
    detailAddress: String(settings.detailAddress || '').trim(),
    phone: String(settings.phone || '').trim(),
    parkingText: String(settings.parkingText || '').trim(),
    mapMode: ['google_embed','osm_fallback'].includes(settings.mapMode) ? settings.mapMode : 'google_embed',
  };
}

async function savePage(slug, page, project = {}, options = {}) {
  if (!page || typeof page !== 'object') {
    const error = new Error('page 객체가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const safe = safeSlug(slug || page.slug);
  const normalizedProject = hasProject(project) ? normalizeProject({ ...project, slug: safe }) : {};
  const targetFile = pageFile(safe, normalizedProject);
  const latest = await readPage(safe, normalizedProject);
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '').trim();
  const latestUpdatedAt = String(latest?.updatedAt || '').trim();
  if (expectedUpdatedAt && latestUpdatedAt && expectedUpdatedAt !== latestUpdatedAt) {
    const error = new Error('Page revision conflict');
    error.status = 409;
    error.details = {
      code: 'PAGE_REVISION_CONFLICT',
      latest: latest ? {
        slug: latest.slug || safe,
        title: latest.title || '',
        updatedAt: latest.updatedAt || '',
        blocks: Array.isArray(latest.blocks) ? latest.blocks.length : 0,
      } : null,
      page: latest || null,
    };
    throw error;
  }

  const saved = {
    ...page,
    slug: safe,
    ...(hasProject(normalizedProject) ? {
      projectId: normalizedProject.projectId,
      ownerId: normalizedProject.ownerId,
    } : {}),
    updatedAt: new Date().toISOString(),
  };

  if (storageRuntime.active === 'd1' && hasProject(normalizedProject)) {
    return upsertD1Page(storageRuntime.d1, saved, {
      projectId: normalizedProject.projectId,
      slug: safe,
      reason: page.revisionReason || options.reason || '',
      createdByAccountId: options.createdByAccountId || '',
    });
  }

  await mkdir(path.dirname(targetFile), { recursive: true });
  await writeFile(targetFile, JSON.stringify(saved, null, 2), 'utf8');
  await writePageRevision(safe, saved, normalizedProject);
  return saved;
}

async function writePageRevision(slug, page, project = {}) {
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    const normalizedProject = normalizeProject({ ...project, slug });
    const current = await getD1PageBySlug(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      slug: safeSlug(slug),
    });
    if (!current?.id) return null;
    return insertD1PageRevision(storageRuntime.d1, { page, reason: page.revisionReason || '' }, {
      pageId: current.id,
      projectId: normalizedProject.projectId,
      revision: Math.max(1, Number(current.revision || 1) + 1),
    });
  }
  const dir = pageRevisionDir(slug, project);
  const revisionId = new Date().toISOString().replace(/[:.]/g, '-');
  const revision = {
    id: revisionId,
    revisionAt: new Date().toISOString(),
    page,
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${revisionId}.json`), JSON.stringify(revision, null, 2), 'utf8');
  await prunePageRevisions(dir, 20);
}

async function prunePageRevisions(dir, limit) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const file of files.slice(limit)) {
    await unlink(path.join(dir, file)).catch(() => {});
  }
}

async function listPageRevisions(slug, project = {}) {
  if (storageRuntime.active === 'd1' && hasProject(project)) {
    const revisions = await listD1PageRevisions(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      slug: safeSlug(slug),
      limit: 20,
    });
    return revisions.map((revision) => ({
      id: revision.id,
      revisionAt: revision.revisionAt || '',
      title: revision.title || '',
      slug: revision.slug || slug,
      updatedAt: revision.updatedAt || '',
      blocks: revision.blocks || 0,
    }));
  }
  const dir = pageRevisionDir(slug, project);
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(0, 20);

  const revisions = [];
  for (const file of files) {
    try {
      const raw = await readFile(path.join(dir, file), 'utf8');
      const revision = JSON.parse(raw);
      revisions.push({
        id: revision.id || file.replace(/\.json$/, ''),
        revisionAt: revision.revisionAt || '',
        title: revision.page?.title || '',
        slug: revision.page?.slug || slug,
        updatedAt: revision.page?.updatedAt || '',
        blocks: Array.isArray(revision.page?.blocks) ? revision.page.blocks.length : 0,
      });
    } catch {}
  }
  return revisions;
}

async function readPageRevision(slug, revisionId, project = {}) {
  const safeRevisionId = safeId(revisionId, '');
  if (!safeRevisionId) {
    const error = new Error('revisionId is required.');
    error.status = 400;
    throw error;
  }

  const normalizedProject = hasProject(project) ? normalizeProject({ ...project, slug }) : {};
  if (storageRuntime.active === 'd1' && hasProject(normalizedProject)) {
    const revision = await getD1PageRevision(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      slug: safeSlug(slug),
      id: safeRevisionId,
    });
    if (revision) return revision;
    const error = new Error('Revision not found.');
    error.status = 404;
    throw error;
  }
  const file = path.join(pageRevisionDir(slug, normalizedProject), `${safeRevisionId}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    const error = new Error('Revision not found.');
    error.status = 404;
    throw error;
  }
}

async function restorePageRevision(slug, revisionId, project = {}) {
  const safeRevisionId = safeId(revisionId, '');
  if (!safeRevisionId) {
    const error = new Error('revisionId가 필요합니다.');
    error.status = 400;
    throw error;
  }

  const normalizedProject = hasProject(project) ? normalizeProject({ ...project, slug }) : {};
  if (storageRuntime.active === 'd1' && hasProject(normalizedProject)) {
    const revision = await readPageRevision(slug, safeRevisionId, normalizedProject);
    const current = await readPage(slug, normalizedProject);
    if (current) await writePageRevision(slug, { ...current, revisionReason: 'pre-restore-backup' }, normalizedProject);
    return savePage(slug, revision.page, normalizedProject, { reason: 'restore' });
  }
  const file = path.join(pageRevisionDir(slug, normalizedProject), `${safeRevisionId}.json`);
  let revision = null;
  try {
    revision = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    const error = new Error('리비전을 찾지 못했습니다.');
    error.status = 404;
    throw error;
  }

  const current = await readPage(slug, normalizedProject);
  if (current) await writePageRevision(slug, { ...current, revisionReason: 'pre-restore-backup' }, normalizedProject);
  return savePage(slug, revision.page, normalizedProject);
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function serverCsvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function serverDeliveryStatusText(status = 'none') {
  return {
    pending: '전송중',
    success: '전송완료',
    failed: '전송실패',
    partial: '일부실패',
    none: '미연결',
  }[status] || '미연결';
}

function serverCsvAnswers(answers = []) {
  return (Array.isArray(answers) ? answers : [])
    .map((answer) => {
      const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '');
      return `${answer.label || answer.id || '항목'}: ${value}`;
    })
    .filter(Boolean)
    .join(' / ');
}

function serverCsvValues(values = {}) {
  return Object.entries(values || {})
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value || '')}`)
    .filter(Boolean)
    .join(' / ');
}

function leadsToCsv(leads = []) {
  const headers = [
    '접수ID',
    '접수유형',
    '상태',
    '접수시간',
    '이름',
    '대표연락처',
    '연락처',
    '이메일',
    '주소',
    '문의내용',
    '메모',
    '외부전송상태',
    '외부전송요약',
    '답변',
    '입력값',
  ];
  const rows = leads.map((lead) => [
    lead.id || '',
    lead.type || '',
    lead.status || '',
    formatCsvDate(lead.createdAt),
    lead.name || '',
    lead.phone || lead.email || lead.address || '',
    lead.phone || '',
    lead.email || '',
    lead.address || '',
    lead.message || '',
    lead.memo || '',
    serverDeliveryStatusText(lead.delivery?.status),
    lead.delivery?.summary || '',
    serverCsvAnswers(lead.answers),
    serverCsvValues(lead.values),
  ]);
  return [headers, ...rows].map((row) => row.map(serverCsvCell).join(',')).join('\r\n');
}

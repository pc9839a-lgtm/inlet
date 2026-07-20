import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { copyFile, mkdir, readFile, writeFile, appendFile, readdir, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { duplicateWindowMs as duplicatePolicyWindowMs, isReservationLead as isReservationLeadPolicy, normalizeLeadContact, sameLeadKind as sameLeadKindPolicy } from '../src/lib/leadDuplicatePolicy.js';
import { buildStats as buildStatsSummary } from '../src/lib/statsMetrics.js';
import { trafficAttributionFromUrl, trafficChannelFromItem } from '../src/lib/trafficAttribution.js';
import { appendJsonlRecord, queryJsonlRecords, readJsonlRecords, writeJsonlRecords } from './storage/jsonlAdapter.mjs';
import { createStorageRuntime, storageRuntimeCoverage, storageRuntimeHealth, storageRuntimePlan } from './storage/runtimeAdapter.mjs';
import { aggregateD1Stats, deleteD1AiDraft, deleteD1Lead, findD1LeadsByContact, findD1LeadsByIntakeSignals, getD1AccountByEmail, getD1AccountByPhone, getD1Lead, getD1PageBySlug, getD1PageRevision, getD1ProjectAccess, getD1PublicPageBySlug, insertD1AuditLog, insertD1BlockedLeadSubmission, insertD1Event, insertD1PageRevision, listD1AiDrafts, listD1BlockedLeadSubmissions, listD1DeliveryLogs, listD1DeliveryRetryQueue, listD1Events, listD1Leads, listD1OwnershipTransferRequests, listD1PageRevisions, replaceD1ProjectMembers, upsertD1Account, upsertD1AiDraft, upsertD1Invite, upsertD1Lead, upsertD1OwnershipTransferRequest, upsertD1Page, upsertD1Project, upsertD1ProjectMember } from './storage/d1Adapter.mjs';
import { sendSesEmail } from '../functions/api/_ses.js';
import { appendGoogleSheetPayload, getGoogleSheetsIntegration, googleClientId, googleClientSecret, mergeGoogleTokens, refreshGoogleAccessToken, updateGoogleSheetsIntegrationStatus } from '../functions/api/integrations/google/sheets/_oauth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const env = loadEnv();
const port = Number(env.INLET_API_PORT || process.env.PORT || 8787);
const dataDir = path.resolve(rootDir, env.INLET_DATA_DIR || 'server/data');
const leadsFile = path.join(dataDir, 'leads.jsonl');
const usersFile = path.join(dataDir, 'users.jsonl');
const emailVerificationsFile = path.join(dataDir, 'email-verifications.jsonl');
const aiKeysFile = path.join(dataDir, 'ai-keys.jsonl');
const auditFile = path.join(dataDir, 'audit.jsonl');
const pagesDir = path.join(dataDir, 'pages');
const storageRuntime = createStorageRuntime(env);
const apiAuthConfig = {
  token: String(env.INLET_API_TOKEN || '').trim(),
  allowedOrigins: parseAllowedOrigins(env.INLET_ALLOWED_ORIGINS || ''),
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
const authEmailMode = normalizeAuthEmailMode(env.INLET_AUTH_EMAIL_MODE || 'mock');
const sesEmailConfig = {
  provider: String(env.INLET_EMAIL_PROVIDER || 'ses').trim().toLowerCase(),
  from: String(env.INLET_AUTH_EMAIL_FROM || env.INLET_LEAD_EMAIL_FROM || env.AWS_SES_FROM || '').trim(),
  accessKeyId: String(env.AWS_SES_ACCESS_KEY_ID || env.INLET_AWS_SES_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || env.SES_ACCESS_KEY_ID || '').trim(),
  secretAccessKey: String(env.AWS_SES_SECRET_ACCESS_KEY || env.INLET_AWS_SES_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || env.SES_SECRET_ACCESS_KEY || '').trim(),
};
const authEmailConfig = {
  mode: authEmailMode,
  exposeToken: env.INLET_AUTH_EMAIL_EXPOSE_TOKEN === '1' || !env.INLET_AUTH_EMAIL_MODE || String(env.INLET_AUTH_EMAIL_MODE).trim().toLowerCase() === 'mock',
};
const emailVerificationConfig = {
  expiresMs: 30 * 60 * 1000,
  cooldownMs: 60 * 1000,
  dailyLimit: 20,
  maxAttempts: 5,
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
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'pagero-api',
        mode: 'local',
        auth: {
          projectEnforced: projectAuthConfig.enforce,
          sessionMode: sessionAuthConfig.mode,
          sourceOfTruth: sessionAuthSource.sourceOfTruth,
          hostedAuthImplemented: sessionAuthSource.hostedAuthImplemented,
          signedSessionReady: !!sessionAuthConfig.secret,
          devHeadersAccepted: sessionAuthConfig.mode === 'dev-headers',
          emailDeliveryMode: authEmailConfig.mode,
          emailDeliveryReady: isLocalAuthEmailReady(),
        },
        storage: {
          ...storageRuntimeHealth(storageRuntime),
          coverage: storageRuntimeCoverage(storageRuntime),
        },
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

    if (req.method === 'GET' && url.pathname === '/api/admin/summary') {
      assertPlatformMaster(req);
      const snapshot = await buildMasterAdminSummary();
      sendJson(res, 200, {
        ok: true,
        mode: storageRuntime.active === 'd1' ? 'live' : 'local',
        generatedAt: new Date().toISOString(),
        ...snapshot,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await readJson(req);
      const user = await registerUserAccount(body?.user || body || {}, { source: 'signup' });
      const projectId = safeId(body?.projectId || body?.user?.projectId || '', '');
      sendJson(res, 200, {
        ok: true,
        user,
        session: createSessionToken({
          ownerId: user.ownerId,
          projectId,
          role: body?.role || body?.user?.role || 'master',
          email: user.email,
        }),
        expiresInSeconds: 60 * 60 * 24 * 30,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/login') {
      await handleGoogleAccountCallback(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(req);
      if (String(body?.provider || '').toLowerCase() === 'google' || String(body?.action || '').toLowerCase() === 'google-oauth-url') {
        const googleUrl = await buildGoogleAccountLoginUrl(req, body || {});
        sendJson(res, 200, { ok: true, url: googleUrl });
        return;
      }
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

    if (req.method === 'PATCH' && url.pathname === '/api/auth/account/status') {
      const body = await readJson(req);
      const result = await updateUserAccountStatus(req, body || {});
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
      const invite = await createManagerInvite(req, project, body?.manager || body?.invite || {});
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
    if (adminTransferMatch && (req.method === 'PATCH' || req.method === 'POST')) {
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
      const result = await acceptManagerInvite(req, decodeURIComponent(inviteAcceptMatch[1]), body || {});
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

    if (req.method === 'GET' && url.pathname === '/api/ai/key') {
      const status = await readAiKeyStatus(req, projectFromQuery(url));
      sendJson(res, 200, { ok: true, key: status });
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/ai/key') {
      const body = await readJson(req);
      const status = await saveAiKey(req, body || {});
      sendJson(res, 200, { ok: true, key: status });
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/ai/key') {
      const body = await readJson(req).catch(() => ({}));
      const status = await deleteAiKey(req, { ...projectFromQuery(url), ...(body || {}) });
      sendJson(res, 200, { ok: true, key: status });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/test') {
      const body = await readJson(req);
      const apiKey = body?.apiKey || await resolveStoredAiKey(req, body?.project || {});
      const scope = body?.apiKey ? null : tryAiKeyScope(req, body?.project || {});
      try {
        await testOpenAi(body?.model, apiKey);
        if (scope) await updateAiKeyTestStatus(req, scope, { status: 'valid', message: 'AI key test succeeded.' });
        sendJson(res, 200, { ok: true, keyTest: { status: 'valid', message: 'AI key test succeeded.' } });
      } catch (error) {
        const keyTest = classifyAiKeyTestError(error);
        if (scope) await updateAiKeyTestStatus(req, scope, keyTest);
        error.details = { ...(error.details || {}), keyTest };
        throw error;
      }
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
      const apiKey = body?.apiKey || await resolveStoredAiKey(req, body?.project || {});
      const draft = await generateAiDraft(body?.input, body?.model, apiKey);
      sendJson(res, 200, { ok: true, draft });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/leads') {
      const body = await readJson(req);
      await normalizePublicLeadPageContext(body);
      body.project = await authorizeProjectAccess(req, body?.project || {}, { write: true, bootstrap: true, page: body?.page || {}, tab: 'inbox', publicSubmit: true });
      body.requestMeta = requestMetaFrom(req);
      const previousLead = await readExistingLeadForDelivery(body.project, body.lead || body);
      let saved = await saveLead(body);
      if (previousLead?.delivery?.logs?.length && !saved.delivery?.logs?.length) {
        saved = { ...saved, delivery: previousLead.delivery };
      }
      saved = await deliverSavedLeadAfterSave(saved, body);
      sendJson(res, 200, { ok: true, lead: saved, delivery: saved.delivery });
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
        channel: url.searchParams.get('channel') || '',
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leads') {
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 50)));
      const cursor = Math.max(0, Number(url.searchParams.get('cursor') || 0));
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await listLeadsPage(limit, project, cursor, {
        kind: url.searchParams.get('kind') || '',
        status: url.searchParams.get('status') || '',
        q: url.searchParams.get('q') || '',
        month: url.searchParams.get('month') || '',
        dateFrom: url.searchParams.get('dateFrom') || '',
        dateTo: url.searchParams.get('dateTo') || '',
        channel: url.searchParams.get('channel') || '',
        deliveryStatus: url.searchParams.get('deliveryStatus') || '',
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/leads/blocked-history') {
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
      const cursor = Math.max(0, Number(url.searchParams.get('cursor') || 0));
      const project = await authorizeProjectAccess(req, projectFromQuery(url), { tab: 'inbox' });
      const result = await listBlockedLeadSubmissions(project, {
        pageSlug: url.searchParams.get('pageSlug') || url.searchParams.get('slug') || '',
        month: url.searchParams.get('month') || '',
        dateFrom: url.searchParams.get('dateFrom') || '',
        dateTo: url.searchParams.get('dateTo') || '',
        limit,
        cursor,
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
        channel: url.searchParams.get('channel') || '',
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
        sendCsv(res, csvFileName(project.slug || 'my-page', exportDateFilters.month), leadsToCsvExportClean(filtered));
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
      sendCsv(res, csvFileName(project.slug || 'my-page', exportDateFilters.month), leadsToCsvExportClean(filtered));
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

    if (req.method === 'POST' && url.pathname === '/api/integrations/test') {
      const body = await readJson(req);
      const result = await testIntegration(body || {});
      sendJson(res, result.ok ? 200 : 502, result);
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
      if (isPublicPageRequest(url)) {
        const page = await readPublicPage(pageMatch[1]);
        if (!page) {
          sendJson(res, 404, { ok: false, error: 'Page not found' });
          return;
        }
        sendJson(res, 200, { ok: true, page }, { 'Cache-Control': 'no-store' });
        return;
      }
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
      const fallbackEmail = await fallbackFreeEmailAlertRecipient(project, access);
      const enforcedPage = enforceFreeEmailAlertRecipient(pageToSave, project, identity, fallbackEmail);
      const publicExisting = await readPublicPage(pageMatch[1]);
      if (publicExisting?.projectId && hasProject(project) && String(publicExisting.projectId) !== String(project.projectId || '')) {
        const error = new Error('Page URL is already in use.');
        error.status = 409;
        error.details = { code: 'PAGE_SLUG_CONFLICT', slug: safeSlug(pageMatch[1]) };
        throw error;
      }
      const saved = await savePage(pageMatch[1], enforcedPage, project, {
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
  console.log(`Pagero API server listening on http://localhost:${port}`);
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

function parseAllowedOrigins(value = '') {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function normalizeAuthEmailMode(value = '') {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'api' || mode === 'ses') return 'api';
  if (mode === 'smtp') return 'smtp';
  return 'mock';
}

function isLocalAuthEmailReady() {
  if (authEmailConfig.mode === 'mock') return true;
  if (authEmailConfig.mode === 'smtp') return !!smtpConfig.host && !!smtpConfig.from;
  if (authEmailConfig.mode === 'api') {
    return sesEmailConfig.provider === 'ses'
      && !!sesEmailConfig.from
      && !!sesEmailConfig.accessKeyId
      && !!sesEmailConfig.secretAccessKey;
  }
  return false;
}

function requestOrigin(req) {
  return String(req?.headers?.origin || '').trim().replace(/\/+$/, '');
}

function firstHeaderValue(value = '') {
  return String(Array.isArray(value) ? value[0] : value || '').split(',')[0].trim();
}

function requestIp(req) {
  return firstHeaderValue(req?.headers?.['cf-connecting-ip'])
    || firstHeaderValue(req?.headers?.['x-forwarded-for'])
    || firstHeaderValue(req?.headers?.['x-real-ip'])
    || String(req?.socket?.remoteAddress || '').trim();
}

function stableRequestHash(value = '') {
  const text = String(value || '').trim();
  return text ? createHash('sha256').update(text).digest('hex').slice(0, 32) : '';
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function requestMetaFrom(req) {
  const userAgent = String(req?.headers?.['user-agent'] || '').trim();
  return {
    ipHash: stableRequestHash(requestIp(req)),
    userAgentHash: stableRequestHash(userAgent),
  };
}

function setCors(req, res) {
  const origin = requestOrigin(req);
  const allowAll = apiAuthConfig.allowedOrigins.length === 0 || apiAuthConfig.allowedOrigins.includes('*');
  const allowedOrigin = allowAll ? '*' : (apiAuthConfig.allowedOrigins.includes(origin) ? origin : '');
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Pragma,X-Inlet-Api-Token,X-Inlet-Owner-Id,X-Inlet-Project-Id,X-Inlet-Session');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function authorizeApiRequest(req, url) {
  if (!apiAuthConfig.token) return { ok: true };
  if (!url.pathname.startsWith('/api/')) return { ok: true };
  if (url.pathname === '/api/health') return { ok: true };
  if (isPublicPageRequest(url)) return { ok: true };
  if (url.pathname === '/api/leads' && req.method === 'POST') return { ok: true };

  const headerToken = String(req.headers['x-inlet-api-token'] || '').trim();
  const auth = String(req.headers.authorization || '').trim();
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!headerToken && !bearer) return { ok: false, status: 401, error: 'Unauthorized' };
  if (headerToken === apiAuthConfig.token || bearer === apiAuthConfig.token) return { ok: true };
  return { ok: false, status: 403, error: 'Forbidden' };
}

function isPublicPageRequest(url) {
  return /^\/api\/pages\/[a-zA-Z0-9-_]+$/.test(url.pathname) && url.searchParams.get('public') === '1';
}

function requestIdentity(req) {
  const session = sessionIdentity(req);
  if (session) return session;
  if (sessionAuthConfig.mode === 'strict') return { ownerId: '', projectId: '', source: 'missing-session' };
  if (sessionAuthConfig.mode === 'hosted') return { ownerId: '', projectId: '', source: 'missing-hosted-auth' };
  return {
    ownerId: safeId(req.headers['x-inlet-owner-id'] || '', ''),
    projectId: safeId(req.headers['x-inlet-project-id'] || '', ''),
    email: normalizeEmail(req.headers['x-inlet-email'] || req.headers['x-inlet-user-email'] || ''),
    source: 'dev-header',
  };
}

function assertPlatformMaster(req) {
  const identity = requestIdentity(req);
  const email = normalizeEmail(identity?.email || '');
  const role = String(identity?.role || '').trim().toLowerCase().replace(/[-\s]/g, '_');
  const configured = String(env.INLET_PLATFORM_MASTER_EMAILS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  const allowedEmails = configured.length ? configured : ['admin@pagero.kr'];
  if (allowedEmails.includes(email) || ['platformmaster', 'platform_master', 'superadmin', 'serviceadmin'].includes(role)) {
    return identity;
  }
  throw accessError('전체 관리자 권한이 필요합니다.', 'PLATFORM_MASTER_REQUIRED');
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
    role: String(payload.role || ''),
    email: normalizeEmail(payload.email || ''),
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

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...(headers || {}) });
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
          'User-Agent': 'PageroLinkPreview/1.0',
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

function aiKeySecret() {
  return createHash('sha256')
    .update(String(env.INLET_AI_KEY_SECRET || sessionAuthConfig.secret || apiAuthConfig.token || 'inlet-local-ai-key-secret'))
    .digest();
}

function encryptAiSecret(value = '') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aiKeySecret(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64url'),
    ciphertext: encrypted.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    algorithm: 'aes-256-gcm',
  };
}

function decryptAiSecret(record = {}) {
  const cipher = record.cipher || {};
  if (!cipher.iv || !cipher.ciphertext || !cipher.tag) return '';
  const decipher = createDecipheriv('aes-256-gcm', aiKeySecret(), Buffer.from(cipher.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(cipher.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipher.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

async function readAiKeyRecords() {
  try {
    return (await readJsonlRecords(aiKeysFile)).records.filter((record) => record && typeof record === 'object');
  } catch {
    return [];
  }
}

function aiKeyScope(req, input = {}) {
  const identity = requestIdentity(req);
  const ownerId = safeId(input.ownerId || identity.ownerId || '', '');
  const projectId = safeId(input.projectId || identity.projectId || '', '');
  if (!ownerId) {
    const error = new Error('Account identity is required for AI key storage.');
    error.status = 401;
    error.details = { code: 'AUTH_SESSION_INVALID' };
    throw error;
  }
  return { ownerId, projectId };
}

function aiKeyRecordId(scope = {}) {
  return [scope.ownerId, scope.projectId || 'account', 'openai'].join(':');
}

function tryAiKeyScope(req, input = {}) {
  try {
    return aiKeyScope(req, input);
  } catch {
    return null;
  }
}

function publicAiKeyStatus(record = null, scope = {}) {
  if (!record || record.status === 'deleted') {
    return {
      provider: 'openai',
      status: 'missing',
      ownerId: scope.ownerId || '',
      projectId: scope.projectId || '',
      connected: false,
    };
  }
  return {
    provider: 'openai',
    status: record.status || 'connected',
    ownerId: record.ownerId || scope.ownerId || '',
    projectId: record.projectId || scope.projectId || '',
    connected: ['connected', 'valid'].includes(record.status || 'connected'),
    maskedKey: record.last4 ? `sk-...${record.last4}` : '',
    updatedAt: record.updatedAt || '',
    lastTestStatus: record.lastTestStatus || '',
    lastTestMessage: record.lastTestMessage || '',
  };
}

async function findAiKeyRecord(scope = {}) {
  const id = aiKeyRecordId(scope);
  const records = await readAiKeyRecords();
  return records.find((record) => record.id === id && record.status !== 'deleted') || null;
}

async function readAiKeyStatus(req, input = {}) {
  const scope = aiKeyScope(req, input);
  return publicAiKeyStatus(await findAiKeyRecord(scope), scope);
}

async function saveAiKey(req, input = {}) {
  const scope = aiKeyScope(req, input);
  const apiKey = String(input.apiKey || input.key || '').trim();
  if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
    const error = new Error('OpenAI API key format is invalid.');
    error.status = 400;
    error.details = { code: 'AI_KEY_INVALID' };
    throw error;
  }
  const now = new Date().toISOString();
  const record = {
    id: aiKeyRecordId(scope),
    ...scope,
    provider: 'openai',
    status: 'connected',
    cipher: encryptAiSecret(apiKey),
    last4: apiKey.slice(-4),
    createdAt: now,
    updatedAt: now,
  };

  const status = await withFileLock(aiKeysFile, async () => {
    const records = await readAiKeyRecords();
    const index = records.findIndex((item) => item.id === record.id);
    const nextRecords = records.slice();
    nextRecords[index >= 0 ? index : nextRecords.length] = {
      ...(index >= 0 ? records[index] : {}),
      ...record,
      createdAt: index >= 0 ? (records[index].createdAt || now) : now,
    };
    await writeJsonlRecords(aiKeysFile, nextRecords);
    return publicAiKeyStatus(nextRecords[index >= 0 ? index : nextRecords.length - 1], scope);
  });
  await writeAiKeyAudit(req, scope, 'ai_key.save', { status: status.status, maskedKey: status.maskedKey });
  return status;
}

async function deleteAiKey(req, input = {}) {
  const scope = aiKeyScope(req, input);
  const id = aiKeyRecordId(scope);
  const now = new Date().toISOString();
  return withFileLock(aiKeysFile, async () => {
    const records = await readAiKeyRecords();
    const index = records.findIndex((item) => item.id === id);
    if (index < 0) return publicAiKeyStatus(null, scope);
    const nextRecords = records.slice();
    nextRecords[index] = {
      ...records[index],
      status: 'deleted',
      deletedAt: now,
      updatedAt: now,
    };
    await writeJsonlRecords(aiKeysFile, nextRecords);
    await writeAiKeyAudit(req, scope, 'ai_key.delete', { previousStatus: records[index]?.status || '' });
    return publicAiKeyStatus(null, scope);
  });
}

async function updateAiKeyTestStatus(req, scope = {}, result = {}) {
  const id = aiKeyRecordId(scope);
  const now = new Date().toISOString();
  const status = String(result.status || 'request_failed');
  const message = String(result.message || '').slice(0, 240);
  let publicStatus = null;
  await withFileLock(aiKeysFile, async () => {
    const records = await readAiKeyRecords();
    const index = records.findIndex((item) => item.id === id && item.status !== 'deleted');
    if (index < 0) return;
    const nextRecords = records.slice();
    const record = records[index];
    nextRecords[index] = {
      ...record,
      status: status === 'valid' ? 'connected' : record.status || 'connected',
      lastTestStatus: status,
      lastTestMessage: message,
      lastTestedAt: now,
      updatedAt: now,
    };
    await writeJsonlRecords(aiKeysFile, nextRecords);
    publicStatus = publicAiKeyStatus(nextRecords[index], scope);
  });
  await writeAiKeyAudit(req, scope, 'ai_key.test', { status, message });
  return publicStatus;
}

function classifyAiKeyTestError(error = {}) {
  const statusCode = Number(error.status || 0);
  const text = String(error.message || error || '');
  if (/api key is required|missing|OPENAI_API_KEY/i.test(text)) {
    return { status: 'missing', message: 'API key is missing.' };
  }
  if (statusCode === 401 || statusCode === 403 || statusCode === 400 || /invalid api key|incorrect api key|authentication|format/i.test(text)) {
    return { status: 'invalid', message: text || 'API key authentication failed.' };
  }
  if (statusCode === 429 || /quota|billing|rate limit/i.test(text)) {
    return { status: 'quota_rate_limited', message: text || 'API quota, rate limit, or billing needs attention.' };
  }
  return { status: 'request_failed', message: text || 'API key test request failed.' };
}

async function writeAiKeyAudit(req, scope = {}, action = '', metadata = {}) {
  await writeAuditLog(req, {
    projectId: scope.projectId || '',
    actorAccountId: scope.ownerId || '',
    action,
    targetType: 'ai_key',
    targetId: aiKeyRecordId(scope),
    metadata,
  });
}

async function writeAuditLog(req, entryInput = {}) {
  const identity = requestIdentity(req);
  const action = String(entryInput.action || '').trim();
  if (!action) return;
  const entry = {
    id: safeId(`${action}_${Date.now()}_${Math.random().toString(16).slice(2)}`, ''),
    projectId: String(entryInput.projectId || '').trim(),
    actorAccountId: safeId(entryInput.actorAccountId || identity.ownerId || '', ''),
    action,
    targetType: String(entryInput.targetType || '').trim(),
    targetId: String(entryInput.targetId || '').trim(),
    ip: req?.socket?.remoteAddress || '',
    userAgent: String(req?.headers?.['user-agent'] || ''),
    metadata: entryInput.metadata || {},
    createdAt: new Date().toISOString(),
  };

  if (storageRuntime.active === 'd1') {
    try {
      await insertD1AuditLog(storageRuntime.d1, entry);
    } catch (error) {
      console.warn('D1 audit write failed:', error?.message || error);
    }
  }

  try {
    await appendJsonlRecord(auditFile, entry);
  } catch (error) {
    console.warn('Audit write failed:', error?.message || error);
  }
}

async function resolveStoredAiKey(req, input = {}) {
  try {
    const scope = aiKeyScope(req, input);
    const record = await findAiKeyRecord(scope);
    return record ? decryptAiSecret(record) : '';
  } catch {
    return '';
  }
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
    input: '정상 연결 확인입니다. OK만 출력하세요.',
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
  const genericPhrases = ['제목과 안내문만', '쉽고 간단하게', '고객 맞춤', '빠른 문의', '문의해주세요', '정보를 남겨주시면', '확인 후 연락', '맞춤형 서비스', '최상의 서비스', '전문적인 상담'];
  const genericHits = genericPhrases.filter((phrase) => compact.includes(phrase.replace(/\s+/g, '')));
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
  if (genericHits.length) issues.push(`반복적인 일반 문구가 남아 있습니다: ${genericHits.slice(0, 3).join(', ')}`);
  if (tokens.length >= 2 && tokenHits < Math.min(2, tokens.length)) issues.push('사용자 입력 키워드가 충분히 반영되지 않았습니다.');
  if (tokens.length >= 2 && tokens.filter((token) => heroText.includes(token)).length < 1) issues.push('히어로에 사용자의 핵심 키워드가 보이지 않습니다.');
  if (textBodies.length >= 2 && new Set(textBodies).size < textBodies.length) issues.push('텍스트 블록 내용이 반복됩니다.');
  if (form && questions.length < 3) issues.push('상담 폼 질문이 너무 적습니다.');
  if (form && meaningfulQuestions.length < 2 && !requestedSections.includes('reservation')) issues.push('폼에 업종 판단 질문이 부족합니다.');
  if (form && meaningfulQuestions.length && weakQuestionLabels >= meaningfulQuestions.length) issues.push('폼 질문 라벨이 너무 일반적입니다.');
  if (requestedSections.includes('reservation') && !blocks.some((block) => block.type === 'reservation')) issues.push('방문예약 목적에 예약 블록이 없습니다.');
  if (requestedSections.includes('timer') && !blocks.some((block) => block.type === 'timer')) issues.push('이벤트 마감 목적에 타이머 블록이 없습니다.');
  if (ctaLabels.length >= 2 && uniqueCtas < 2) issues.push('CTA/버튼 문구가 행동별로 구분되지 않았습니다.');

  return issues.slice(0, 5);
}
function buildQualityRepairPrompt(basePrompt, draft, issues, input) {
  return `
아래 초안은 품질 검사에서 보강이 필요합니다. 같은 JSON 스키마를 유지하되 더 깊고 구체적인 전환형 랜딩페이지 초안으로 다시 작성하세요.

[보강 사유]
${issues.map((issue) => `- ${issue}`).join('\n')}

[보강 지침]
- 업종/서비스에 가까운 선택 키워드를 카피에 자연스럽게 넣으세요.
- 각 text 블록은 서로 다른 역할을 맡기세요. 예: 문제 공감, 선택 기준, 진행 흐름, 신뢰 근거 중 하나.
- body는 최소 35자 이상, 모바일에서 읽히는 1~2문장으로 쓰세요.
- 폼 질문은 이름/연락처 외에 업종별 판단에 필요한 항목을 1~3개 추가하세요.
- 질문 라벨은 "문의내용" 같은 일반 라벨보다 일정, 현재 상황, 관심 항목, 예산/규모처럼 판단 가능한 항목으로 쓰세요.
- 버튼 문구는 상담, 예약, 전화, 확인 같은 행동이 구분되게 쓰세요.
- 요청 섹션에 reservation/timer가 있으면 해당 블록을 우선 포함하세요.
- 일반 템플릿 문구를 제거하고 실제 ${input.industry || '서비스'} 랜딩처럼 보이게 만드세요.

[원래 요청]
${basePrompt}

[보강 전 초안]
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
    || /server error|timeout|temporarily unavailable|retry|rate limit|요청 시간|서버 오류|잠시 후/i.test(message);
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
    return 'OpenAI API 인증에 실패했습니다. 고객 API 키 또는 서버 OPENAI_API_KEY를 확인하세요.';
  }

  if (status === 429 || /rate limit|quota|billing/i.test(text)) {
    return 'OpenAI 사용 한도 또는 결제 설정 문제로 요청이 막혔습니다. OpenAI 계정의 결제/한도를 확인하세요.';
  }

  if (status >= 500) {
    return `OpenAI 서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.${suffix}`;
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
    goal: String(input.goal || '상담 신청').trim(),
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
    auto: 'creativeSeed를 기준으로 trust, promo, booking, story, compare 중 하나를 골라 같은 입력이어도 구조와 문장이 반복되지 않게 만드세요.',
    trust: '신뢰형: 문제 공감 -> 전문성/검증 근거 -> 선택 기준 -> 문의 유도 순서로 차분하게 구성하세요.',
    promo: '프로모션형: 강한 첫 문장 -> 혜택/마감/한정성 -> 빠른 CTA 순서로 구성하되 허위 보장과 과장은 금지하세요.',
    booking: '예약전환형: 일정 선택 장점 -> 상담/방문 흐름 -> 예약 CTA -> reservation 중심으로 구성하세요.',
    story: '스토리형: 고객 상황 -> 해결 장면 -> 선택 이유 -> 행동 유도 순서로 감각적이지만 짧게 쓰세요.',
    compare: '비교형: 기존 방식의 불편 -> 이 서비스의 차이 -> 선택 기준 -> 문의 CTA 순서로 구성하세요.',
  };
  return guides[style] || guides.auto;
}

function buildAiDraftPrompt(input) {
  const allowed = allowedBlockTypes.join(', ');
  const selectedTemplate = input.templateStyle || 'auto';
  return `
당신은 전환율 높은 모바일 랜딩페이지를 설계하는 한국어 카피라이터이자 UX 설계자입니다.
사용자 입력을 바탕으로 편집 가능한 랜딩페이지 블록 JSON만 생성하세요.

[중요 규칙]
- HTML, CSS, JavaScript, 마크다운, 코드블록 없이 JSON만 출력하세요.
- 허용 블록 타입만 사용하세요: ${allowed}
- benefit은 블록 타입이 아닙니다. 혜택 섹션은 type:"text"로 만드세요.
- topnav, bottombar, footer는 생성하지 마세요.
- 모든 문구는 모바일 첫 화면 기준으로 짧고 명확하게 작성하세요.
- 고객의 불안, 선택 기준, 다음 행동을 자연스럽게 연결하세요.
- 과장 광고, 허위 보장, 검증 불가능한 수치는 금지하세요.
- 모든 블록은 서로 다른 역할을 가져야 하며 같은 상담 유도 문장을 반복하지 마세요.
- 전체 블록은 5~8개 정도로 구성하세요.
- form을 만들면 이름과 연락처는 필수로 포함하고, 업종별 판단 질문을 1~3개 추가하세요.
- links는 실제 행동 버튼 역할이어야 하며 form, reservation, phone, url 중 하나로 연결하세요.
- 전화번호나 외부 URL이 입력되지 않았으면 임의 전화번호/URL을 만들지 마세요.
- 이미지 URL이 없으면 image 블록을 만들지 마세요.
- timer는 이벤트, 마감, 한정 상담 목적일 때만 사용하세요.
- map은 위치/방문이 중요한 서비스에서만 사용하고 placeName, address, detailAddress, phone, parkingText, mapMode만 넣으세요.
- 선택 템플릿: ${selectedTemplate}
- 템플릿 가이드: ${aiTemplateGuide(selectedTemplate)}
- creativeSeed: ${input.creativeSeed || 'none'}

[사용자 입력]
자유 요청: ${input.prompt || '없음'}
업종: ${input.industry || '미입력'}
서비스명/상품명: ${input.serviceName || '미입력'}
랜딩 목적: ${input.goal}
핵심 혜택: ${input.benefit || '미입력'}
CTA 문구: ${input.cta}
연락 방식: ${input.contactMethod}
대상 고객: ${input.targetCustomer || '미입력'}
톤: ${input.tone || 'premium'}
강조 문구: ${input.keyMessage || '없음'}
제외 표현: ${input.avoidWords || '없음'}
포함 섹션: ${(input.sections || []).join(', ')}
추천 메타: ${JSON.stringify(input.templateMeta || null)}

[출력 JSON 스키마]
{
  "pageTitle": "문자열",
  "brandName": "브랜드 또는 서비스명",
  "templateStyle": "trust|promo|booking|story|compare",
  "qualityNote": "구성 의도 한 문장",
  "primaryAction": { "label": "대표 CTA", "target": "form|reservation|phone|url", "url": "" },
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
    { "type": "links", "title": "문자열", "layout": "list|card|carousel", "items": [{ "label": "문자열", "target": "form|reservation|phone|url", "url": "", "emoji": "문자 1개 또는 빈 문자열", "iconMode": "emoji|none" }] },
    { "type": "map", "placeName": "문자열", "address": "문자열", "detailAddress": "문자열", "phone": "문자열", "parkingText": "문자열", "mapMode": "google_embed" },
    { "type": "timer", "label": "마감까지 남은 시간", "repeatMode": "daily24|fixed", "timerTheme": "modern|glass|minimal|accent", "urgentStyle": "flip|line|flow|none", "ctaLabel": "문자열" },
    { "type": "activity", "title": "실시간 접수 현황", "mode": "feed|count", "sampleKind": "consult|reservation|both", "style": "minimal|glass|dark" },
    { "type": "form", "title": "문자열", "desc": "문자열", "submit": "문자열", "style": "card|line|soft|minimal", "inputStyle": "round|box|underline", "buttonStyle": "solid|round|line", "buttonHover": "fill|slide|zoom", "questions": [{ "label": "이름", "type": "name|short|phone|email|long|select|multi|address", "required": true, "placeholder": "문자열", "options": ["선택지"] }] },
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
    const error = new Error('이미지 블록에는 실제 이미지 URL이 필요합니다. 이미지를 쓰지 않거나 실제 이미지 URL을 넣어 다시 생성하세요.');
    error.status = 502;
    throw error;
  }
  const badLink = draft.blocks.find((block) => block?.type === 'links' && Array.isArray(block.items) && block.items.some((item) => {
    if (item?.target === 'phone') return !/^tel:\d[\d-]+$/i.test(String(item.url || '').trim());
    if (item?.target === 'url') return !/^https?:\/\//i.test(String(item.url || '').trim());
    return false;
  }));
  if (badLink) {
    const error = new Error('전화 또는 외부 링크에는 실제 연결 주소가 필요합니다. 전화번호/URL을 입력하거나 해당 링크를 제외하세요.');
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
  const normalizedLead = normalizeServerLead(lead, body);
  const saved = {
    ...normalizedLead,
    savedAt: new Date().toISOString(),
    page: body.page || normalizedLead.page || null,
    ...(hasProject(project) ? { project } : {}),
  };

  if (storageRuntime.active === 'd1' && hasProject(project)) {
    const policy = await leadIntakePolicy(saved, project, { d1: true, page: body.page || {} });
    if (policy.blocked) {
      await recordBlockedLeadSubmission(policy, saved, project, { d1: true });
      throw leadRateLimitError(policy);
    }
    Object.assign(saved, policy.leadPatch);
    const duplicate = null;
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
    const policy = await leadIntakePolicy(saved, project, { page: body.page || {} });
    if (policy.blocked) {
      await recordBlockedLeadSubmission(policy, saved, project);
      throw leadRateLimitError(policy);
    }
    Object.assign(saved, policy.leadPatch);
    const duplicate = null;
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
      return leads[index];
    } else {
      await appendJsonlRecord(targetFile, saved);
    }
    return saved;
  });
}

async function normalizePublicLeadPageContext(body = {}) {
  const inputPage = body.page && typeof body.page === 'object' ? body.page : {};
  const inputProject = hasProject(body.project) ? normalizeProject(body.project) : {};
  const slug = safeSlug(inputPage.slug || body.lead?.pageSlug || inputProject.slug || '');
  if (!slug) return body;

  const publicPage = await readPublicPage(slug);
  if (!publicPage?.projectId) {
    body.page = { ...inputPage, slug };
    body.project = { ...inputProject, slug: inputProject.slug || slug };
    return body;
  }

  body.project = normalizeProject({
    ...inputProject,
    projectId: publicPage.projectId,
    id: publicPage.projectId,
    slug: publicPage.slug || slug,
    title: publicPage.title || inputProject.title || '',
  });
  body.page = {
    ...inputPage,
    projectId: publicPage.projectId,
    id: publicPage.id || inputPage.id || '',
    slug: publicPage.slug || slug,
    title: inputPage.title || publicPage.title || '',
    integrations: publicPage.integrations || inputPage.integrations || {},
    leadDuplicateSettings: publicPage.leadDuplicateSettings || inputPage.leadDuplicateSettings || {},
    duplicateCollectionSettings: publicPage.duplicateCollectionSettings || inputPage.duplicateCollectionSettings || {},
  };
  return body;
}

async function deliverSavedLeadAfterSave(saved = {}, body = {}) {
  if (!saved || typeof saved !== 'object') return saved;
  const project = hasProject(body.project) ? normalizeProject(body.project) : {};
  const pageSlug = safeSlug(body.page?.slug || saved.pageSlug || project.slug || '');
  const storedPage = pageSlug ? await readPage(pageSlug, project) : null;
  const deliveryPage = await ensureServerDeliveryEmailRecipient(deliveryPageFrom({
    ...(body.page || {}),
    ...(storedPage || {}),
    projectId: storedPage?.projectId || body.page?.projectId || project.projectId || '',
    integrations: storedPage?.integrations || body.page?.integrations || {},
  }), project);
  const sentKeys = await successfulDeliveryKeysForLead(project, saved);
  const delivery = await sendServerLeadIntegrations(saved, deliveryPage, { skipSuccessfulIdempotencyKeys: sentKeys });
  if (delivery.status === 'none' && saved.delivery?.status) {
    return saved;
  }
  const patch = {
    delivery,
    deliveryStatus: delivery.status,
    deliveryPage,
  };
  if (!saved.id) return { ...saved, ...patch };
  try {
    return await updateLead(saved.id, patch, project);
  } catch {
    return { ...saved, ...patch };
  }
}

async function readExistingLeadForDelivery(project = {}, lead = {}) {
  const id = String(lead?.id || '').trim();
  if (!id) return null;
  const targetProject = hasProject(project) ? normalizeProject(project) : {};
  try {
    if (storageRuntime.active === 'd1' && hasProject(targetProject)) {
      return getD1Lead(storageRuntime.d1, { projectId: targetProject.projectId, id });
    }
    const leads = await readLeadList(targetProject);
    return leads.find((item) => String(item.id || '') === id) || null;
  } catch {
    return null;
  }
}

async function successfulDeliveryKeysForLead(project = {}, lead = {}) {
  const embeddedKeys = (lead.delivery?.logs || [])
    .filter((log) => log?.status === 'success')
    .map((log) => log.idempotencyKey)
    .filter(Boolean);
  if (storageRuntime.active !== 'd1' || !storageRuntime.d1?.prepare || !hasProject(project) || !lead?.id) return embeddedKeys;
  try {
    const result = await listD1DeliveryLogs(storageRuntime.d1, {
      projectId: project.projectId,
      leadId: lead.id,
      status: 'success',
      limit: 100,
    });
    return Array.from(new Set([...embeddedKeys, ...(result.records || []).map((log) => log.idempotencyKey).filter(Boolean)]));
  } catch {
    return embeddedKeys;
  }
}

async function ensureServerDeliveryEmailRecipient(page = {}, project = {}) {
  const integrations = page.integrations && typeof page.integrations === 'object' ? page.integrations : {};
  const email = integrations.email && typeof integrations.email === 'object' ? integrations.email : {};
  if (!email.enabled || isValidEmail(email.to)) return page;

  const fallback = await serverDeliveryEmailFallback(project);
  if (!fallback) return page;
  return {
    ...page,
    integrations: {
      ...integrations,
      email: {
        ...email,
        to: fallback,
        lockedToAccount: email.lockedToAccount !== false,
      },
    },
  };
}

function normalizeServerLead(lead = {}, body = {}) {
  const delivery = lead.delivery || {};
  const requestMeta = body.requestMeta || {};
  const source = lead.source && typeof lead.source === 'object' ? lead.source : {};
  const page = body.page && typeof body.page === 'object' ? body.page : {};
  const values = lead.values && typeof lead.values === 'object' ? lead.values : {};
  const phoneNormalized = normalizeLeadPhone(lead.phone || lead.values?.phone || '');
  const emailNormalized = normalizeLeadEmail(lead.email || lead.values?.email || '');
  const clientId = String(lead.clientId || body.clientId || lead.values?.clientId || lead.cookieId || lead.visitorId || '').trim();
  const submittedAt = lead.submittedAt || lead.createdAt || lead.savedAt || new Date().toISOString();
  const sourceUrl = lead.sourceUrl || source.sourceUrl || source.url || source.pageUrl || values.sourceUrl || '';
  const rawLeadType = String(lead.type || lead.kind || lead.category || '').trim();
  const sourceAttribution = trafficAttributionFromUrl(sourceUrl);
  const utmSource = lead.utmSource || lead.utm_source || source.utmSource || source.utm_source || values.utmSource || values.utm_source || sourceAttribution.utmSource || '';
  const utmMedium = lead.utmMedium || lead.utm_medium || source.utmMedium || source.utm_medium || values.utmMedium || values.utm_medium || sourceAttribution.utmMedium || '';
  const utmCampaign = lead.utmCampaign || lead.utm_campaign || source.utmCampaign || source.utm_campaign || values.utmCampaign || values.utm_campaign || sourceAttribution.utmCampaign || '';
  const channel = lead.channel || source.channel || values.channel || (sourceUrl ? sourceAttribution.channel : '') || '';
  const sourceLabel = lead.sourceLabel || source.sourceLabel || values.sourceLabel || channel || '';
  return {
    ...lead,
    id: lead.id || randomId(),
    pageSlug: lead.pageSlug || page.slug || body.project?.slug || '',
    pageId: lead.pageId || page.id || '',
    pageTitle: lead.pageTitle || page.title || '',
    pageUrl: lead.pageUrl || page.url || source.pageUrl || '',
    sourceUrl,
    referrer: lead.referrer || source.referrer || values.referrer || '',
    channel,
    sourceLabel,
    utmSource,
    utmMedium,
    utmCampaign,
    source,
    rawType: rawLeadType,
    type: isReservationLeadPolicy(lead) ? '방문예약' : '상담신청',
    status: ['신규', '확인중', '연락완료', '예약완료', '보류', '종료'].includes(lead.status) ? lead.status : '신규',
    memo: lead.memo || '',
    createdAt: submittedAt,
    submittedAt,
    clientId,
    ipHash: String(lead.ipHash || requestMeta.ipHash || '').trim(),
    userAgentHash: String(lead.userAgentHash || requestMeta.userAgentHash || '').trim(),
    phoneNormalized,
    emailNormalized,
    duplicate: !!lead.duplicate,
    duplicateReason: String(lead.duplicateReason || '').trim(),
    riskScore: Math.max(0, Number(lead.riskScore || 0)),
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    values: {
      ...values,
      ...(clientId ? { clientId } : {}),
      ...(phoneNormalized ? { phoneNormalized } : {}),
      ...(emailNormalized ? { emailNormalized } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(source.referrer || values.referrer ? { referrer: source.referrer || values.referrer } : {}),
      ...(channel ? { channel } : {}),
      ...(sourceLabel ? { sourceLabel } : {}),
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
    },
    delivery: {
      status: delivery.status || 'none',
      summary: delivery.summary || '외부 전송 없음',
      logs: Array.isArray(delivery.logs) ? delivery.logs.slice(-20) : [],
      ...(delivery.retry ? { retry: delivery.retry } : {}),
    },
  };
}

function normalizeLeadPhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function normalizeLeadEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function leadTimeMs(lead = {}) {
  const time = Date.parse(lead.submittedAt || lead.createdAt || lead.savedAt || '');
  return Number.isNaN(time) ? Date.now() : time;
}

function leadPageKey(lead = {}) {
  return String(lead.pageSlug || lead.page?.slug || lead.project?.slug || lead.sourcePageSlug || '').trim();
}

function sameLeadPage(a = {}, b = {}) {
  const left = leadPageKey(a);
  const right = leadPageKey(b);
  return !left || !right || left === right;
}

function leadPolicyMonth(value = '') {
  const text = String(value || new Date().toISOString()).slice(0, 7);
  return /^\d{4}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 7);
}

function normalizeLeadDuplicateSettings(settings = {}) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const rawCount = Number(source.formDuplicateLimitCount ?? source.fieldDuplicateLimitCount ?? source.duplicateLimitCount ?? 3);
  const phoneEmailMode = String(source.phoneEmailMode || source.phoneEmailDuplicateMode || source.contactDuplicateMode || 'mark').trim();
  const windowKey = String(source.formDuplicateLimitWindow || source.fieldDuplicateLimitPeriod || source.duplicateWindow || source.duplicateWindowKey || '1mo').trim();
  return {
    rejectIpDuplicate: !!(source.rejectIpDuplicate ?? source.ipDuplicateRejectEnabled ?? false),
    rejectCookieDuplicate: source.rejectCookieDuplicate ?? source.cookieDuplicateRejectEnabled ?? false ? true : false,
    formDuplicateLimitCount: Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 1)),
    formDuplicateLimitWindow: windowKey,
    formDuplicateLimitMs: duplicatePolicyWindowMs(windowKey),
    phoneEmailMode: ['block', 'reject', 'deny'].includes(phoneEmailMode) ? 'block' : 'mark',
  };
}

function leadPolicySettingsFrom(lead = {}, options = {}) {
  return normalizeLeadDuplicateSettings(
    options.settings ||
    lead.page?.leadDuplicateSettings ||
    lead.page?.duplicateCollectionSettings ||
    options.page?.leadDuplicateSettings ||
    options.page?.duplicateCollectionSettings ||
    {},
  );
}

function previousPolicyMonth(month = '') {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function uniqueLeads(leads = []) {
  const seen = new Set();
  return leads.slice().reverse().filter((lead) => {
    const key = String(lead.id || `${lead.createdAt}:${lead.phone}:${lead.email}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).reverse();
}

async function leadPolicyCandidates(lead = {}, project = {}, options = {}) {
  if (!options.d1) return readLeadList(project);
  const normalizedProject = normalizeProject(project);
  const month = leadPolicyMonth(lead.submittedAt || lead.createdAt);
  const months = [month, previousPolicyMonth(month)].filter(Boolean);
  const phone = lead.phoneNormalized || normalizeLeadPhone(lead.phone);
  const email = lead.emailNormalized || normalizeLeadEmail(lead.email);
  const pages = await Promise.all(months.map(async (itemMonth) => {
    return findD1LeadsByIntakeSignals(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      month: itemMonth,
      pageSlug: leadPageKey(lead),
      phone,
      email,
      clientId: lead.clientId || lead.values?.clientId || '',
      ipHash: lead.ipHash || '',
      limit: 200,
    });
  }));
  return uniqueLeads(pages.flat());
}

async function leadIntakePolicy(lead = {}, project = {}, options = {}) {
  const candidates = (await leadPolicyCandidates(lead, project, options))
    .filter((item) => item && String(item.id || '') !== String(lead.id || ''));
  const settings = leadPolicySettingsFrom(lead, options);
  const now = leadTimeMs(lead);
  const phone = lead.phoneNormalized || normalizeLeadPhone(lead.phone);
  const email = lead.emailNormalized || normalizeLeadEmail(lead.email);
  const clientId = String(lead.clientId || '').trim();
  const ipHash = String(lead.ipHash || '').trim();
  const reasons = new Set();
  let clientWindowCount = 0;
  let ipWindowCount = 0;

  for (const item of candidates) {
    if (!sameLeadPage(item, lead)) continue;
    const age = now - leadTimeMs(item);
    if (age < 0) continue;
    const itemPhone = item.phoneNormalized || normalizeLeadPhone(item.phone);
    const itemEmail = item.emailNormalized || normalizeLeadEmail(item.email);
    if (age <= settings.formDuplicateLimitMs && phone && itemPhone === phone) reasons.add('phone_30d');
    if (age <= settings.formDuplicateLimitMs && email && itemEmail === email) reasons.add('email_30d');
    if (age <= 30 * 60 * 1000 && clientId && String(item.clientId || item.values?.clientId || '').trim() === clientId) reasons.add('client_repeat_30m');
    if (age <= settings.formDuplicateLimitMs && clientId && String(item.clientId || item.values?.clientId || '').trim() === clientId) clientWindowCount += 1;
    if (age <= settings.formDuplicateLimitMs && ipHash && String(item.ipHash || '').trim() === ipHash) ipWindowCount += 1;
  }

  if (settings.phoneEmailMode === 'block' && (reasons.has('phone_30d') || reasons.has('email_30d'))) {
    return {
      blocked: true,
      reason: reasons.has('phone_30d') ? 'phone_duplicate' : 'email_duplicate',
      retryAfter: Math.ceil(settings.formDuplicateLimitMs / 1000),
      policySnapshot: settings,
      leadPatch: duplicateLeadPatch(reasons),
    };
  }

  if (settings.rejectCookieDuplicate && clientId && clientWindowCount >= settings.formDuplicateLimitCount) {
    return {
      blocked: true,
      reason: 'client_duplicate_limit',
      retryAfter: Math.ceil(settings.formDuplicateLimitMs / 1000),
      policySnapshot: settings,
      leadPatch: duplicateLeadPatch(reasons),
    };
  }

  if (settings.rejectIpDuplicate && ipHash && ipWindowCount >= settings.formDuplicateLimitCount) {
    return {
      blocked: true,
      reason: 'ip_duplicate_limit',
      retryAfter: Math.ceil(settings.formDuplicateLimitMs / 1000),
      policySnapshot: settings,
      leadPatch: duplicateLeadPatch(reasons),
    };
  }

  const ipMinuteCount = ipHash ? candidates.filter((item) => {
    if (!sameLeadPage(item, lead)) return false;
    if (String(item.ipHash || '').trim() !== ipHash) return false;
    const age = now - leadTimeMs(item);
    return age >= 0 && age <= 60 * 1000;
  }).length : 0;
  if (ipMinuteCount >= 3) {
    return { blocked: true, reason: 'ip_rate_limit_1m', retryAfter: 60, policySnapshot: settings, leadPatch: duplicateLeadPatch(reasons) };
  }

  const ipDayCount = ipHash ? candidates.filter((item) => {
    if (String(item.ipHash || '').trim() !== ipHash) return false;
    const age = now - leadTimeMs(item);
    return age >= 0 && age <= 24 * 60 * 60 * 1000;
  }).length : 0;
  if (ipDayCount >= 20) reasons.add('spam_suspected');

  return {
    blocked: false,
    policySnapshot: settings,
    leadPatch: duplicateLeadPatch(reasons),
  };
}

function duplicateLeadPatch(reasons = new Set()) {
  const duplicateReason = Array.from(reasons).join(',');
  return {
    duplicate: reasons.has('phone_30d') || reasons.has('email_30d') || reasons.has('client_repeat_30m'),
    duplicateReason,
    riskScore: Math.min(100, (reasons.has('spam_suspected') ? 70 : 0) + (duplicateReason ? 30 : 0)),
  };
}

function blockedLeadSubmissionRecord(policy = {}, lead = {}, project = {}) {
  const now = new Date().toISOString();
  const createdAt = lead.submittedAt || lead.createdAt || now;
  const phone = lead.phoneNormalized || normalizeLeadPhone(lead.phone || lead.values?.phone || '');
  const email = lead.emailNormalized || normalizeLeadEmail(lead.email || lead.values?.email || '');
  const pageSlug = leadPageKey(lead) || project.slug || '';
  return {
    id: `blocked_${randomId()}`,
    projectId: project.projectId || '',
    pageSlug,
    reason: String(policy.reason || 'rate_limited'),
    riskScore: Number(policy.leadPatch?.riskScore || 100),
    policySnapshot: policy.policySnapshot || {},
    ipHash: String(lead.ipHash || ''),
    clientId: String(lead.clientId || lead.values?.clientId || ''),
    userAgentHash: String(lead.userAgentHash || ''),
    contactSummary: [phone ? maskContactValue(phone) : '', email ? maskContactValue(email) : ''].filter(Boolean).join(' / '),
    fieldSummary: {
      name: String(lead.name || lead.values?.name || '').slice(0, 80),
      type: String(lead.type || lead.kind || lead.category || '').slice(0, 40),
      phoneTail: phone ? phone.slice(-4) : '',
      emailDomain: email.includes('@') ? email.split('@').pop() : '',
    },
    createdMonth: leadPolicyMonth(createdAt),
    createdAt,
  };
}

function maskContactValue(value = '') {
  const text = String(value || '');
  if (!text) return '';
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    return `${name.slice(0, 2)}***@${domain || ''}`;
  }
  return text.length > 4 ? `${text.slice(0, 3)}****${text.slice(-4)}` : '****';
}

async function recordBlockedLeadSubmission(policy = {}, lead = {}, project = {}, options = {}) {
  const entry = blockedLeadSubmissionRecord(policy, lead, project);
  if (options.d1 && storageRuntime.active === 'd1' && hasProject(project)) {
    await insertD1BlockedLeadSubmission(storageRuntime.d1, entry, {
      projectId: normalizeProject(project).projectId,
      pageSlug: entry.pageSlug,
    });
    return entry;
  }
  const targetFile = projectBlockedLeadsFile(project) || path.join(dataDir, 'blocked-leads.jsonl');
  await mkdir(path.dirname(targetFile), { recursive: true });
  await appendJsonlRecord(targetFile, entry);
  return entry;
}

async function listBlockedLeadSubmissions(project = {}, filters = {}) {
  const normalizedFilters = normalizeDateFilters(filters);
  if (storageRuntime.active === 'd1' && hasProject(project) && normalizedFilters.month) {
    const result = await listD1BlockedLeadSubmissions(storageRuntime.d1, {
      projectId: normalizeProject(project).projectId,
      pageSlug: filters.pageSlug || '',
      month: normalizedFilters.month,
      dateFrom: normalizedFilters.dateFrom || '',
      dateTo: normalizedFilters.dateTo || '',
      limit: filters.limit,
      cursor: filters.cursor,
    });
    return {
      records: result.records,
      total: result.total,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      queryPlan: storageQueryPlan('blocked-leads', normalizedFilters),
    };
  }
  const targetFile = projectBlockedLeadsFile(project) || path.join(dataDir, 'blocked-leads.jsonl');
  const result = await queryJsonlRecords(targetFile, {
    type: 'blocked-leads',
    filters: { ...normalizedFilters, pageSlug: filters.pageSlug || '' },
    limit: filters.limit || 50,
    cursor: filters.cursor || 0,
    filter: (entry) => matchesBlockedLeadFilters(entry, { ...normalizedFilters, pageSlug: filters.pageSlug || '' }),
    plan: storageQueryPlan('blocked-leads', normalizedFilters),
  });
  return {
    records: result.records,
    total: result.total,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    queryPlan: result.queryPlan,
  };
}

function matchesBlockedLeadFilters(entry = {}, filters = {}) {
  if (filters.pageSlug && String(entry.pageSlug || '') !== String(filters.pageSlug)) return false;
  return dateRangeFilter({ createdAt: entry.createdAt || '' }, filters);
}

function leadRateLimitError(policy = {}) {
  const error = new Error('Too many lead submissions. Please retry later.');
  error.status = 429;
  error.details = { code: 'LEAD_RATE_LIMITED', reason: policy.reason || 'rate_limited', retryAfter: policy.retryAfter || 60 };
  return error;
}

async function findDuplicateLead(lead = {}, project = {}) {
  return null;
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
  return null;
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
    event.utmSource || event.utm_source,
    event.utmMedium || event.utm_medium,
    event.utmCampaign || event.utm_campaign,
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
  const sourceAttribution = trafficAttributionFromUrl(event.sourceUrl || event.source_url || event.url || '');
  const attribution = {
    ...sourceAttribution,
    utmSource: event.utmSource || event.utm_source || sourceAttribution.utmSource,
    utmMedium: event.utmMedium || event.utm_medium || sourceAttribution.utmMedium,
    utmCampaign: event.utmCampaign || event.utm_campaign || sourceAttribution.utmCampaign,
  };
  const saved = {
    ...event,
    id: event.id || randomId(),
    type: String(event.type || ''),
    label: String(event.label || ''),
    channel: String(attribution.utmSource || 'direct'),
    utmSource: String(attribution.utmSource || ''),
    utmMedium: String(attribution.utmMedium || ''),
    utmCampaign: String(attribution.utmCampaign || ''),
    sourceUrl: String(event.sourceUrl || event.source_url || event.url || ''),
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
  const channel = String(filters.channel || '').trim().toLowerCase();
  return { ...filters, dateFrom, dateTo, channel };
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
    channel: url.searchParams.get('channel') || '',
  });
}

function matchesStatsChannel(item = {}, channel = '') {
  const safe = String(channel || '').trim().toLowerCase();
  if (!safe || safe === 'all') return true;
  return trafficChannelFromItem(item) === safe;
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
    const filteredRecords = dateFilters.channel
      ? result.records.filter((event) => matchesStatsChannel(event, dateFilters.channel))
      : result.records;
    return {
      events: filteredRecords,
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
    filter: (event) => (!(dateFilters.dateFrom || dateFilters.dateTo) || dateRangeFilter(event, dateFilters)) && matchesStatsChannel(event, dateFilters.channel),
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
  return uniqueLeads(parsed.records);
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
  if (dateFilters.channel && !matchesStatsChannel(lead, dateFilters.channel)) return false;
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
      dateFrom: dateFilters.dateFrom,
      dateTo: dateFilters.dateTo,
      channel: dateFilters.channel,
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
      channel: dateFilters.channel || '',
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
      filter: (event) => (!(dateFilters.dateFrom || dateFilters.dateTo) || dateRangeFilter(event, dateFilters)) && matchesStatsChannel(event, dateFilters.channel),
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
  const statsNow = dateFilters.dateTo
    ? new Date(`${dateFilters.dateTo}T12:00:00+09:00`)
    : new Date();
  const stats = buildStatsSummary(scopedEvents, scopedLeads, period, statsNow);
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
    const nextLead = normalizeDeliveryStatusField({ ...current, ...safePatch, updatedAt: new Date().toISOString() });
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
    leads[index] = normalizeDeliveryStatusField({ ...leads[index], ...safePatch, updatedAt: new Date().toISOString() });
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

function normalizeDeliveryStatusField(lead = {}) {
  const deliveryStatus = String(lead.delivery?.status || '').trim();
  return deliveryStatus ? { ...lead, deliveryStatus } : lead;
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
    const currentDelivery = baseLead.delivery || {};
    const providers = currentDelivery.status === 'partial' ? failedServerDeliveryProviders(currentDelivery) : [];
    const retryDelivery = await sendServerLeadIntegrations(baseLead, deliveryPage, { providers });
    const delivery = currentDelivery.status === 'partial'
      ? mergeServerDeliveryReports(currentDelivery, retryDelivery)
      : retryDelivery;
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
    const currentDelivery = baseLead.delivery || {};
    const providers = currentDelivery.status === 'partial' ? failedServerDeliveryProviders(currentDelivery) : [];
    const retryDelivery = await sendServerLeadIntegrations(baseLead, deliveryPage, { providers });
    const delivery = currentDelivery.status === 'partial'
      ? mergeServerDeliveryReports(currentDelivery, retryDelivery)
      : retryDelivery;
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
    const currentDelivery = leads[i].delivery || {};
    const providers = currentDelivery.status === 'partial' ? failedServerDeliveryProviders(currentDelivery) : [];
    const retryDelivery = await sendServerLeadIntegrations(leads[i], deliveryPage, { providers });
    const delivery = currentDelivery.status === 'partial'
      ? mergeServerDeliveryReports(currentDelivery, retryDelivery)
      : retryDelivery;
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
    leads[i] = normalizeDeliveryStatusField({
      ...leads[i],
      delivery: {
        ...delivery,
        retry,
      },
      deliveryPage,
      updatedAt: new Date().toISOString(),
    });
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
    const currentDelivery = lead.delivery || {};
    const providers = currentDelivery.status === 'partial' ? failedServerDeliveryProviders(currentDelivery) : [];
    const retryDelivery = await sendServerLeadIntegrations(lead, deliveryPage, { providers });
    const delivery = currentDelivery.status === 'partial'
      ? mergeServerDeliveryReports(currentDelivery, retryDelivery)
      : retryDelivery;
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
    const saved = await upsertD1Lead(storageRuntime.d1, normalizeDeliveryStatusField({
      ...lead,
      delivery: { ...delivery, retry },
      deliveryPage,
      updatedAt: new Date().toISOString(),
    }), {
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
    const { records: leads } = await readJsonlFile(targetFile);
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
    id: page.id || '',
    projectId: page.projectId || page.project?.projectId || '',
    title: page.title || '',
    slug: page.slug || '',
    url: page.publicUrl || page.url || '',
    publicUrl: page.publicUrl || page.url || '',
    integrations: page.integrations || {},
  };
}

async function sendServerLeadIntegrations(lead, page = {}, options = {}) {
  let jobs = buildServerIntegrationJobs(page.integrations || {}, lead, page);
  const retryProviders = new Set((options.providers || []).map((provider) => String(provider || '').trim()).filter(Boolean));
  if (retryProviders.size) {
    jobs = jobs.filter((job) => retryProviders.has(String(job.provider || '').trim()));
  }
  const skipKeys = new Set((options.skipSuccessfulIdempotencyKeys || []).map((key) => String(key || '').trim()).filter(Boolean));
  const skippedJobs = skipKeys.size ? jobs.filter((job) => skipKeys.has(String(job.idempotencyKey || '').trim())) : [];
  jobs = skipKeys.size ? jobs.filter((job) => !skipKeys.has(String(job.idempotencyKey || '').trim())) : jobs;
  const skippedLogs = skippedJobs.map((job) => ({
    target: job.label,
    provider: job.provider || job.type || '',
    status: 'success',
    message: '이미 전송 완료',
    idempotencyKey: job.idempotencyKey || '',
    skippedDuplicate: true,
    at: new Date().toISOString(),
  }));
  if (!jobs.length) {
    return skippedLogs.length ? summarizeServerDelivery(skippedLogs) : { status: 'none', summary: '외부 전송 없음', logs: [] };
  }

  const settled = await Promise.allSettled(jobs.map(async (job) => {
    const res = await runServerIntegrationJob(job);
    return {
      target: job.label,
      provider: job.provider || job.type || '',
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
      provider: job?.provider || job?.type || '',
      status: 'failed',
      message: String(item.reason?.message || item.reason || '전송 실패'),
      idempotencyKey: job?.idempotencyKey || '',
      at: new Date().toISOString(),
    };
  });

  return summarizeServerDelivery([...skippedLogs, ...logs]);
}

function buildServerIntegrationJobs(integrations = {}, lead = {}, page = {}) {
  const payload = {
    schemaVersion: 'pagero.lead.v1',
    event: 'lead.created',
    source: 'pagero',
    brand: '페이지로',
    page: {
      title: page.title || '',
      slug: page.slug || '',
    },
    lead,
    contact: {
      name: lead.name || lead.values?.name || '',
      phone: lead.phone || lead.values?.phone || '',
      email: lead.email || lead.values?.email || '',
    },
    createdAt: lead.createdAt || new Date().toISOString(),
  };
  const jobs = [];

  if (integrations.email?.enabled && isValidEmail(integrations.email.to) && shouldSendEmailForLead(integrations.email, lead)) {
    jobs.push({
      type: 'email',
      provider: 'ses',
      label: '이메일 알림',
      to: integrations.email.to,
      subject: `[${page.title || '랜딩페이지'}] ${lead.type || '상담신청'} 접수`,
      text: buildLeadEmailText(lead, page),
    });
  }

  if (integrations.webhook?.enabled && isValidHttpUrl(integrations.webhook.url)) {
    jobs.push({
      type: 'http',
      provider: 'webhook',
      label: 'Webhook',
      url: integrations.webhook.url,
      payload: { ...payload, target: 'webhook', service: integrations.webhook.service || 'custom' },
      secret: integrations.webhook.secret || '',
    });
  }

  if (integrations.automation?.enabled && isValidHttpUrl(integrations.automation.url)) {
    jobs.push({
      type: 'http',
      provider: 'automation',
      label: `자동화 · ${serviceLabel(integrations.automation.service || 'make')}`,
      url: integrations.automation.url,
      payload: { ...payload, target: 'automation', service: integrations.automation.service || 'make' },
      secret: integrations.automation.secret || '',
    });
  }

  const sheetsUrl = integrations.sheets?.webhookUrl || integrations.sheets?.url || '';
  if (integrations.sheets?.enabled && String(integrations.sheets.mode || '').toLowerCase() === 'oauth') {
    jobs.push({
      type: 'google_sheets_oauth',
      provider: 'google_sheets',
      label: 'Google Sheets',
      projectId: page.projectId || page.id || '',
      spreadsheetId: integrations.sheets.spreadsheetId || '',
      sheetName: integrations.sheets.sheetName || '접수함',
      payload: googleSheetsServerPayload(payload, integrations.sheets, page, lead),
    });
  } else if (integrations.sheets?.enabled && isValidHttpUrl(sheetsUrl)) {
    jobs.push({
      type: 'http',
      provider: 'google_sheets',
      label: '구글 시트',
      url: sheetsUrl,
      payload: {
        ...googleSheetsServerPayload(payload, integrations.sheets, page, lead),
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
  if (job.type === 'google_sheets_oauth') return sendServerGoogleSheetsOAuthJob(job);
  return postServerIntegration(job.url, {
    ...(job.payload || {}),
    idempotencyKey: job.idempotencyKey || '',
  }, job.secret, job.idempotencyKey);
}

async function sendServerGoogleSheetsOAuthJob(job = {}) {
  const projectId = String(job.projectId || job.payload?.project?.id || '').trim();
  if (!storageRuntime.d1?.prepare || !projectId) {
    return { ok: false, message: 'Google Sheets 연결 필요' };
  }

  const integration = await getGoogleSheetsIntegration(storageRuntime.d1, projectId);
  if (!integration || integration.status !== 'connected') {
    return { ok: false, message: 'Google Sheets 연결 필요' };
  }

  const settings = integration.settings || {};
  let tokens = integration.tokens || {};
  const spreadsheetId = String(job.spreadsheetId || settings.spreadsheetId || integration.externalId || '').trim();
  const sheetName = String(job.sheetName || settings.sheetName || '접수함').trim() || '접수함';
  let accessToken = String(tokens.accessToken || '').trim();

  try {
    if (!accessToken && tokens.refreshToken) {
      tokens = mergeGoogleTokens(tokens, await refreshGoogleAccessToken({
        refreshToken: tokens.refreshToken,
        clientId: googleClientId(env),
        clientSecret: googleClientSecret(env),
      }));
      accessToken = tokens.accessToken || '';
      await updateGoogleSheetsIntegrationStatus(storageRuntime.d1, projectId, { tokens });
    }

    try {
      await appendGoogleSheetPayload({ accessToken, spreadsheetId, sheetName, payload: job.payload || {} });
    } catch (error) {
      if (Number(error?.status || 0) !== 401 || !tokens.refreshToken) throw error;
      tokens = mergeGoogleTokens(tokens, await refreshGoogleAccessToken({
        refreshToken: tokens.refreshToken,
        clientId: googleClientId(env),
        clientSecret: googleClientSecret(env),
      }));
      accessToken = tokens.accessToken || '';
      await appendGoogleSheetPayload({ accessToken, spreadsheetId, sheetName, payload: job.payload || {} });
      await updateGoogleSheetsIntegrationStatus(storageRuntime.d1, projectId, { tokens });
    }

    await updateGoogleSheetsIntegrationStatus(storageRuntime.d1, projectId, {
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
      lastError: '',
      settings: { ...settings, spreadsheetId, sheetName },
      tokens,
    });
    return { ok: true, message: 'Google Sheets 전송 완료' };
  } catch (error) {
    const message = safeGoogleSheetsSendMessage(error);
    await updateGoogleSheetsIntegrationStatus(storageRuntime.d1, projectId, {
      status: 'error',
      lastError: message,
    }).catch(() => {});
    return { ok: false, message };
  }
}

function safeGoogleSheetsSendMessage(error) {
  const status = Number(error?.status || 0);
  if (status === 401) return 'Google Sheets 인증 만료';
  if (status === 403) return 'Google Sheets 권한 없음';
  if (status === 404) return 'Google Sheets 파일 없음';
  if (status === 400) return 'Google Sheets 설정 필요';
  return 'Google Sheets 전송 실패';
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
  const leadKey = lead.id || lead.contactKey || lead.phoneNormalized || lead.emailNormalized || lead.createdAt || lead.submittedAt || '';
  return [
    leadKey,
    job.provider || job.type || '',
    job.label || '',
  ]
    .map((value) => String(value || '').replace(/[^a-zA-Z0-9_.:-]/g, '-'))
    .filter(Boolean)
    .join(':')
    .slice(0, 180);
}

function googleSheetsServerPayload(payload = {}, sheets = {}, page = {}, lead = {}) {
  const fields = leadAnswerFields(lead);
  const source = {
    utmSource: lead.utmSource || lead.source?.utmSource || lead.attribution?.utmSource || '',
    utmMedium: lead.utmMedium || lead.source?.utmMedium || lead.attribution?.utmMedium || '',
    utmCampaign: lead.utmCampaign || lead.source?.utmCampaign || lead.attribution?.utmCampaign || '',
    referrer: lead.referrer || lead.source?.referrer || lead.attribution?.referrer || '',
    sourceUrl: lead.sourceUrl || lead.source?.sourceUrl || lead.attribution?.sourceUrl || lead.pageUrl || '',
  };
  return {
    schemaVersion: payload.schemaVersion || 'pagero.lead.v1',
    event: payload.event || 'lead.created',
    service: payload.source || 'pagero',
    target: 'google_sheets',
    provider: 'google_sheets',
    mode: sheets.mode || 'webhook',
    spreadsheetId: sheets.spreadsheetId || '',
    sheetName: sheets.sheetName || '접수함',
    connectedEmail: sheets.connectedEmail || '',
    lead: {
      id: lead.id || payload.lead?.id || '',
      name: lead.name || lead.values?.name || payload.contact?.name || '',
      phone: lead.phone || lead.values?.phone || payload.contact?.phone || '',
      email: lead.email || lead.values?.email || payload.contact?.email || '',
      message: lead.message || lead.values?.message || '',
      createdAt: lead.createdAt || payload.createdAt || new Date().toISOString(),
      fields,
    },
    page: {
      id: page.id || page.projectId || '',
      title: page.title || payload.page?.title || '',
      slug: page.slug || payload.page?.slug || '',
      url: page.publicUrl || page.url || '',
    },
    project: {
      id: page.projectId || page.id || '',
    },
    source,
    attribution: source,
    integration: {
      provider: 'google_sheets',
      mode: sheets.mode || 'webhook',
      spreadsheetId: sheets.spreadsheetId || '',
      connectedEmail: sheets.connectedEmail || '',
      status: sheets.status || '',
    },
    createdAt: payload.createdAt || lead.createdAt || new Date().toISOString(),
  };
}

function leadAnswerFields(lead = {}) {
  const fields = {};
  const reservedKeys = new Set(['name', 'phone', 'email', 'message']);
  const reservedLabels = new Set(['이름', '성함', '연락처', '전화번호', '핸드폰번호', '휴대폰번호', '이메일', '메일', '문의내용', '문의 내용', '메시지', '내용']);

  for (const [rawKey, rawValue] of Object.entries(lead.values || {})) {
    const key = String(rawKey || '').trim();
    if (!key || reservedKeys.has(key.toLowerCase()) || reservedLabels.has(key)) continue;
    fields[key] = normalizeSheetFieldValue(rawValue);
  }

  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    const key = String(answer?.label || answer?.name || answer?.id || '').trim();
    const type = String(answer?.type || '').trim().toLowerCase();
    if (!key || reservedKeys.has(key.toLowerCase()) || reservedLabels.has(key) || reservedKeys.has(type)) continue;
    fields[key] = normalizeSheetFieldValue(answer?.value ?? answer?.text ?? '');
  }

  return fields;
}

function normalizeSheetFieldValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function jobHeaderValue(value = '') {
  return String(value || '').trim().slice(0, 180);
}

async function sendEmailNotification(job) {
  const provider = String(env.INLET_EMAIL_PROVIDER || env.INLET_LEAD_EMAIL_PROVIDER || '').trim().toLowerCase();
  if (provider === 'mock') {
    return { ok: true, provider: 'mock', message: 'mock email sent' };
  }

  if (provider === 'ses' || env.AWS_SES_ACCESS_KEY_ID || env.INLET_AWS_SES_ACCESS_KEY_ID) {
    try {
      await sendSesEmail({
        to: job.to,
        from: env.INLET_LEAD_EMAIL_FROM || env.INLET_AUTH_EMAIL_FROM || env.AWS_SES_FROM || '',
        subject: job.subject,
        text: job.text,
        html: job.html || '',
      }, env);
      return { ok: true, provider: 'ses' };
    } catch (error) {
      return { ok: false, message: String(error?.providerMessage || error?.message || error) };
    }
  }
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
  const inputType = Object.prototype.hasOwnProperty.call(lead, 'rawType')
    ? lead.rawType
    : lead.type || lead.kind || lead.category || '';
  const type = String(inputType || '').trim();
  const consultEnabled = email.consult !== false;
  const reservationEnabled = email.reservation !== false;
  if (/예약|방문|reservation|booking|reserve/i.test(type)) return reservationEnabled;
  if (!type || /unknown|custom|lead|submit|form/i.test(type)) return consultEnabled || reservationEnabled;
  return consultEnabled;
}

function buildLeadEmailText(lead = {}, page = {}) {
  const answers = Array.isArray(lead.answers) ? lead.answers : [];
  const answerLines = answers.map((answer) => {
    const value = Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value || '-');
    return `- ${answer.label || answer.id || '답변'}: ${value}`;
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
  if (!isValidEmail(to)) throw new Error('받을 이메일 주소를 확인하세요.');
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

function failedServerDeliveryProviders(delivery = {}) {
  return Array.from(new Set((delivery.logs || [])
    .filter((log) => log?.status === 'failed')
    .map((log) => String(log.provider || '').trim())
    .filter(Boolean)));
}

function mergeServerDeliveryReports(previous = {}, retry = {}) {
  const retriedProviders = new Set((retry.logs || []).map((log) => String(log.provider || '').trim()).filter(Boolean));
  const keptLogs = (previous.logs || []).filter((log) => !retriedProviders.has(String(log.provider || '').trim()));
  return summarizeServerDelivery([...keptLogs, ...(retry.logs || [])]);
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

function formatCsvDate(value = '') {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function csvFileName(slug = 'my-page', month = '') {
  const safeSlug = safeSlugForFile(slug || 'my-page');
  const date = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : new Date().toISOString().slice(0, 10);
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

function csvCleanFieldLabel(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const CSV_CLEAN_BASE_VALUE_KEYS = new Set([
  'name',
  'phone',
  'email',
  'address',
  'message',
  'memo',
  'clientId',
  'phoneNormalized',
  'emailNormalized',
  'sourceUrl',
  'referrer',
  'channel',
  'sourceLabel',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  '이름',
  '성함',
  '연락처',
  '전화번호',
  '휴대폰번호',
  '핸드폰번호',
  '이메일',
  '메일',
  '주소',
  '문의 내용',
  '문의내용',
  '메시지',
]);

function csvCleanUniqueHeader(base, used) {
  let header = base || '입력값';
  let index = 2;
  while (used.has(header)) {
    header = `${base} ${index}`;
    index += 1;
  }
  used.add(header);
  return header;
}

function csvCleanDynamicHeaders(leads = []) {
  const keyToHeader = new Map();
  const usedHeaders = new Set();
  const add = (rawKey, rawLabel) => {
    const key = csvCleanFieldLabel(rawKey);
    const label = csvCleanFieldLabel(rawLabel || rawKey);
    if (!key || CSV_CLEAN_BASE_VALUE_KEYS.has(key)) return;
    if (keyToHeader.has(key)) return;
    keyToHeader.set(key, csvCleanUniqueHeader(label, usedHeaders));
  };
  for (const lead of leads || []) {
    for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
      add(answer.id || answer.label, answer.label || answer.id);
    }
    for (const key of Object.keys(lead.values || {})) {
      add(key, key);
    }
  }
  return keyToHeader;
}

function csvCleanDynamicMap(lead = {}, dynamicHeaders = new Map()) {
  const fields = {};
  const set = (rawKey, value) => {
    const key = csvCleanFieldLabel(rawKey);
    const header = dynamicHeaders.get(key);
    if (header) fields[header] = csvFlatValue(value);
  };
  for (const [key, value] of Object.entries(lead.values || {})) {
    set(key, value);
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    set(answer.id || answer.label, answer.value);
  }
  return fields;
}

function leadsToCsvExportCleanLegacy(leads = []) {
  const dynamicHeaders = csvCleanDynamicHeaders(leads);
  const dynamicHeaderLabels = [...dynamicHeaders.values()];
  const headers = [
    '접수 ID',
    '접수 유형',
    '상태',
    '접수일시',
    '이름',
    '대표 연락처',
    '연락처',
    '이메일',
    '주소',
    '문의 내용',
    '예약일',
    '예약시간',
    '메모',
    'duplicate',
    'duplicateReason',
    'riskScore',
    'submittedAt',
    '페이지명',
    '페이지 URL',
    '유입 URL',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    ...dynamicHeaderLabels,
  ];
  const rows = leads.map((lead) => {
    const dynamicFields = csvCleanDynamicMap(lead, dynamicHeaders);
    const source = lead.source || {};
    const page = lead.page || lead.deliveryPage || {};
    return [
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
      csvFieldByCleanLabel(lead, [/reservationDate|예약일|date/i]),
      csvFieldByCleanLabel(lead, [/reservationTime|예약시간|time/i]),
      lead.memo || '',
      lead.duplicate ? 'yes' : 'no',
      lead.duplicateReason || '',
      lead.riskScore ?? '',
      formatCsvDate(lead.submittedAt || lead.createdAt),
      page.title || lead.pageTitle || '',
      page.url || lead.pageUrl || '',
      source.url || source.pageUrl || lead.sourceUrl || '',
      source.utmSource || lead.utmSource || '',
      source.utmMedium || lead.utmMedium || '',
      source.utmCampaign || lead.utmCampaign || '',
      ...dynamicHeaderLabels.map((header) => dynamicFields[header] || ''),
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function leadsToCsvExportClean(leads = []) {
  const dynamicHeaders = csvCleanDynamicHeaders(leads);
  const dynamicHeaderLabels = [...dynamicHeaders.values()];
  const headers = [
    '접수 ID',
    '접수 유형',
    '상태',
    '접수일시',
    '이름',
    '대표 연락처',
    '연락처',
    '이메일',
    '주소',
    '문의 내용',
    '예약일',
    '예약시간',
    '메모',
    '중복 여부',
    '중복 사유',
    '위험 점수',
    '제출일시',
    '페이지명',
    '페이지 URL',
    '유입 URL',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    ...dynamicHeaderLabels,
  ];
  const rows = leads.map((lead) => {
    const dynamicFields = csvCleanDynamicMap(lead, dynamicHeaders);
    const source = lead.source || {};
    const page = lead.page || lead.deliveryPage || {};
    return [
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
      csvFieldByCleanLabel(lead, [/reservationDate|예약일|date/i]),
      csvFieldByCleanLabel(lead, [/reservationTime|예약시간|time/i]),
      lead.memo || '',
      lead.duplicate ? 'yes' : 'no',
      lead.duplicateReason || '',
      lead.riskScore ?? '',
      formatCsvDate(lead.submittedAt || lead.createdAt),
      page.title || lead.pageTitle || '',
      page.url || lead.pageUrl || '',
      source.url || source.pageUrl || lead.sourceUrl || '',
      source.utmSource || lead.utmSource || '',
      source.utmMedium || lead.utmMedium || '',
      source.utmCampaign || lead.utmCampaign || '',
      ...dynamicHeaderLabels.map((header) => dynamicFields[header] || ''),
    ];
  });
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
    const currentDelivery = leads[i].delivery || {};
    const providers = currentDelivery.status === 'partial' ? failedServerDeliveryProviders(currentDelivery) : [];
    const retryDelivery = await sendServerLeadIntegrations(leads[i], deliveryPage, { providers });
    const delivery = currentDelivery.status === 'partial'
      ? mergeServerDeliveryReports(currentDelivery, retryDelivery)
      : retryDelivery;
    const previousRetry = leads[i].delivery?.retry || {};
    const attempts = Number(previousRetry.attempts || 0) + 1;
    const deadLetter = delivery.status !== 'success' && attempts >= deliveryRetryConfig.maxAttempts;
    leads[i] = normalizeDeliveryStatusField({
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
    });
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

function isFreePlan(value = '') {
  const plan = String(value || 'free').trim().toLowerCase();
  return !['paid', 'pro', 'premium', 'business', 'agency', 'enterprise'].includes(plan);
}

function enforceFreeEmailAlertRecipient(page = {}, project = {}, identity = null, fallbackEmail = '') {
  const email = normalizeEmail(identity?.email || fallbackEmail || page?.ownership?.ownerEmail || page?.ownerEmail || project?.clientEmail || '');
  if (!email) return page;
  const plan = page.plan || page.billingPlan || page.billing?.plan || project.plan || project.billingPlan || 'free';
  if (!isFreePlan(plan)) return page;
  const integrations = page.integrations && typeof page.integrations === 'object' ? page.integrations : {};
  const emailIntegration = integrations.email && typeof integrations.email === 'object' ? integrations.email : {};
  return {
    ...page,
    integrations: {
      ...integrations,
      email: {
        ...emailIntegration,
        to: email,
        lockedToAccount: true,
      },
    },
  };
}

async function fallbackFreeEmailAlertRecipient(project = {}, access = null) {
  const fromAccess = normalizeEmail(access?.ownerEmail || access?.clientEmail || '');
  if (fromAccess) return fromAccess;
  if (storageRuntime.active !== 'd1' || !storageRuntime.d1 || !hasProject(project)) return '';
  try {
    const normalizedProject = normalizeProject(project);
    const row = await storageRuntime.d1.prepare(`
      SELECT accounts.email AS owner_email, projects.client_email AS client_email
      FROM projects
      LEFT JOIN accounts ON accounts.id = projects.owner_account_id
      WHERE projects.id = ?
      LIMIT 1
    `).bind(normalizedProject.projectId).first();
    return normalizeEmail(row?.client_email || row?.owner_email || '');
  } catch {
    return '';
  }
}

async function serverDeliveryEmailFallback(project = {}) {
  const fromProject = normalizeEmail(project.clientEmail || '');
  if (fromProject && !fromProject.endsWith('@public.inlet.local')) return fromProject;
  if (storageRuntime.active !== 'd1' || !storageRuntime.d1 || !hasProject(project)) return '';
  try {
    const normalizedProject = normalizeProject(project);
    const row = await storageRuntime.d1.prepare(`
      SELECT accounts.email AS owner_email, projects.client_email AS client_email
      FROM projects
      LEFT JOIN accounts ON accounts.id = projects.owner_account_id
      WHERE projects.id = ?
      LIMIT 1
    `).bind(normalizedProject.projectId).first();
    const email = normalizeEmail(row?.client_email || row?.owner_email || '');
    return email && !email.endsWith('@public.inlet.local') ? email : '';
  } catch {
    return '';
  }
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
  return {
    ownerId,
    projectId,
    slug,
    clientEmail: normalizeEmail(project.clientEmail || ''),
    ownerAccountId: safeId(project.ownerAccountId || project.ownerId || ownerId, ''),
    plan: String(project.plan || project.billingPlan || '').trim(),
    billingPlan: String(project.billingPlan || project.plan || '').trim(),
  };
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

async function testIntegration(body = {}) {
  const type = String(body.type || '').trim();
  if (type !== 'sheets') return { ok: false, error: '지원하지 않는 연동 테스트입니다.' };
  const targetUrl = String(body.url || body.webhookUrl || '').trim();
  if (!isGoogleAppsScriptUrl(targetUrl)) {
    return { ok: false, error: 'Google Apps Script 웹 앱 URL(/exec)을 입력해주세요.' };
  }
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : sampleSheetsPayload(body);
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: googleScriptErrorMessage(response.status, text),
    };
  }
  return {
    ok: true,
    status: response.status,
    message: 'Google Sheets에 테스트 행을 보냈습니다. 시트를 확인해주세요.',
    body: text.slice(0, 500),
  };
}

function isGoogleAppsScriptUrl(value = '') {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname === 'script.google.com' && /\/macros\/s\/.+\/exec$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function sampleSheetsPayload(body = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 'pagero.lead.v1',
    event: 'lead.test',
    service: 'pagero',
    target: 'google_sheets',
    provider: 'google_sheets',
    mode: 'webhook',
    spreadsheetId: body.spreadsheetId || '',
    sheetName: body.sheetName || '접수함',
    connectedEmail: body.connectedEmail || '',
    lead: {
      id: `test-${Date.now()}`,
      name: '연결 테스트',
      phone: '010-0000-0000',
      email: '',
      message: 'Google Sheets 연결 테스트',
      createdAt: now,
      fields: { 테스트: '성공 확인용', '관심 타입': '84A', 예산대: '5억~7억' },
    },
    page: body.page || { title: '페이지로 테스트', slug: '', url: '' },
    project: body.project || {},
    source: { utmSource: 'connection_test', utmMedium: '', utmCampaign: '', referrer: '', sourceUrl: '' },
    attribution: { utmSource: 'connection_test', utmMedium: '', utmCampaign: '', referrer: '', sourceUrl: '' },
    createdAt: now,
  };
}

function googleScriptErrorMessage(status, text = '') {
  if (status === 401 || status === 403) return 'Apps Script 웹 앱 접근 권한을 “모든 사용자”로 배포해야 합니다.';
  if (/not found|404/i.test(text)) return 'Apps Script 배포 URL이 잘못됐습니다. /exec URL을 다시 복사해주세요.';
  return `Google Apps Script 응답 실패: ${status}`;
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
    status: normalizeAccountStatus(user.status || 'active'),
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    suspendedAt: user.suspendedAt || '',
    deletedAt: user.deletedAt || '',
    createdAt: user.createdAt || '',
    updatedAt: user.updatedAt || '',
  };
}

function normalizeAccountStatus(value = 'active') {
  const status = String(value || 'active').trim().toLowerCase();
  if (status === 'deleted') return 'deleted_pending_retention';
  return ['active', 'pending_verification', 'suspended', 'deleted_pending_retention'].includes(status) ? status : 'active';
}

function assertAccountActive(user = {}, action = 'use account') {
  const status = normalizeAccountStatus(user.status || 'active');
  if (status === 'active') return;
  const error = new Error(status === 'deleted_pending_retention' ? 'Account is deleted.' : status === 'pending_verification' ? 'Email verification is required.' : 'Account is suspended.');
  error.status = 403;
  error.details = {
    code: status === 'deleted_pending_retention'
      ? 'AUTH_ACCOUNT_DELETED'
      : status === 'pending_verification'
        ? 'EMAIL_VERIFICATION_REQUIRED'
        : 'AUTH_ACCOUNT_SUSPENDED',
    action,
  };
  throw error;
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

function emailVerificationCode() {
  return String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
}

async function assertLocalEmailVerificationSendAllowed(email = '', purpose = 'signup') {
  const records = await readEmailVerifications();
  const now = Date.now();
  const cooldownAt = now - emailVerificationConfig.cooldownMs;
  const dailyAt = now - 24 * 60 * 60 * 1000;
  const matching = records.filter((record) => normalizeEmail(record.email || '') === email && String(record.purpose || 'signup') === purpose);
  const recent = matching.find((record) => Date.parse(record.createdAt || '') >= cooldownAt);
  if (recent) {
    const error = new Error('Verification email was requested too recently.');
    error.status = 429;
    error.details = { code: 'EMAIL_VERIFICATION_COOLDOWN', retryAfterSeconds: Math.ceil(emailVerificationConfig.cooldownMs / 1000) };
    throw error;
  }
  const dailyCount = matching.filter((record) => Date.parse(record.createdAt || '') >= dailyAt).length;
  if (dailyCount >= emailVerificationConfig.dailyLimit) {
    const error = new Error('Too many verification emails were requested today.');
    error.status = 429;
    error.details = { code: 'EMAIL_VERIFICATION_DAILY_LIMIT', retryAfterSeconds: 60 * 60 };
    throw error;
  }
}

function publicEmailVerification(record = {}) {
  const delivery = record.delivery && typeof record.delivery === 'object'
    ? record.delivery
    : { mode: 'mock', status: 'issued' };
  return {
    email: normalizeEmail(record.email || ''),
    purpose: String(record.purpose || 'signup'),
    status: record.status || 'pending',
    expiresAt: record.expiresAt || '',
    delivery,
    ...(record.token && authEmailConfig.exposeToken ? { token: record.token } : {}),
  };
}

async function deliverEmailVerification(record = {}) {
  if (authEmailConfig.mode === 'mock') {
    return {
      mode: 'mock',
      status: 'issued',
      message: 'Offline QA mode returns the verification token in the API response.',
    };
  }

  if (authEmailConfig.mode === 'api') {
    if (sesEmailConfig.provider !== 'ses') {
      const error = new Error('Email verification provider is not supported.');
      error.status = 503;
      error.details = { code: 'EMAIL_SEND_PROVIDER_UNSUPPORTED', provider: sesEmailConfig.provider };
      throw error;
    }
    if (!isLocalAuthEmailReady()) {
      const error = new Error('Email verification delivery is not configured.');
      error.status = 503;
      error.details = { code: 'EMAIL_SEND_NOT_CONFIGURED', provider: 'ses' };
      throw error;
    }
    const purpose = authEmailPurposeLabel(record.purpose);
    try {
      const result = await sendSesEmail({
        to: record.email,
        from: sesEmailConfig.from,
        subject: `[페이지로] ${purpose} 이메일 인증 코드`,
        text: authEmailVerificationText(record, purpose),
        html: authEmailVerificationHtml(record, purpose),
      }, env);
      return {
        mode: 'api',
        provider: 'ses',
        status: 'sent',
        ...(result.messageId ? { messageId: result.messageId } : {}),
      };
    } catch (sendError) {
      const error = new Error('Email verification delivery failed.');
      error.status = 503;
      error.details = {
        code: sendError?.code || 'EMAIL_SEND_FAILED',
        provider: 'ses',
        ...(sendError?.httpStatus ? { httpStatus: sendError.httpStatus } : {}),
      };
      throw error;
    }
  }

  if (!smtpConfig.host || !smtpConfig.from) {
    return {
      mode: 'smtp',
      status: 'skipped',
      reason: 'smtp_not_configured',
      message: 'SMTP settings are missing. Configure INLET_SMTP_HOST and INLET_SMTP_FROM before live email verification.',
    };
  }

  const purpose = authEmailPurposeLabel(record.purpose);
  const result = await sendEmailNotification({
    to: record.email,
    subject: `[페이지로] ${purpose} 이메일 인증 코드`,
    text: authEmailVerificationText(record, purpose),
  });

  return {
    mode: 'smtp',
    status: result.ok ? 'sent' : 'failed',
    ...(result.message ? { message: result.message } : {}),
  };
}

function authEmailPurposeLabel(purpose = '') {
  return String(purpose || 'signup') === 'password-reset' ? '비밀번호 변경' : '회원가입';
}

function authEmailVerificationText(record = {}, purpose = authEmailPurposeLabel(record.purpose)) {
  return [
    '페이지로 이메일 인증 코드입니다.',
    '',
    `용도: ${purpose}`,
    `확인 코드: ${record.token}`,
    `만료 시간: ${record.expiresAt || '-'}`,
    '',
    '본인이 요청하지 않았다면 고객센터에 문의해주세요.',
    `고객센터: ${env.INLET_SUPPORT_EMAIL || 'support@pagero.kr'}`,
    '',
    '페이지로',
    '대표 김도윤 · 사업자번호 538-42-01450',
  ].join('\n');
}

function authEmailVerificationHtml(record = {}, purpose = authEmailPurposeLabel(record.purpose)) {
  const code = String(record.token || '').replace(/[^\d]/g, '').slice(0, 6);
  const expiresAt = escapeHtml(record.expiresAt || '-');
  const supportEmail = escapeHtml(env.INLET_SUPPORT_EMAIL || 'support@pagero.kr');
  return `<!doctype html>
<html lang="ko">
  <body style="margin:0;background:#f3f7fb;font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#101827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7fb;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #dbe6f3;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;">
                <div style="font-size:22px;font-weight:900;letter-spacing:-.02em;">페이지로</div>
                <p style="margin:18px 0 6px;color:#2563eb;font-size:13px;font-weight:900;">${escapeHtml(purpose)} 이메일 인증</p>
                <h1 style="margin:0;color:#101827;font-size:26px;line-height:1.25;letter-spacing:-.04em;">확인 코드를 입력해주세요.</h1>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 28px 24px;">
                <div style="display:inline-block;min-width:240px;padding:22px 28px;border-radius:22px;background:#f8fbff;border:1px solid #dbe6f3;">
                  <div style="font-size:13px;font-weight:900;color:#64748b;">확인 코드</div>
                  <div style="margin-top:8px;font-size:46px;line-height:1;font-weight:900;letter-spacing:.12em;color:#101827;">${escapeHtml(code)}</div>
                </div>
                <p style="margin:18px 0 0;color:#64748b;font-size:14px;font-weight:700;">이 코드는 전송 후 30분이 지나면 만료됩니다.</p>
                <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">만료 시간: ${expiresAt}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;border-top:1px solid #edf2f7;color:#64748b;font-size:13px;line-height:1.7;">
                본인이 요청하지 않았다면 고객센터에 문의해주세요.<br>
                고객센터: <a href="mailto:${supportEmail}" style="color:#2563eb;text-decoration:none;font-weight:800;">${supportEmail}</a><br><br>
                페이지로<br>
                대표 김도윤 · 사업자번호 538-42-01450
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function issueEmailVerification(emailInput = '', purposeInput = 'signup') {
  const email = normalizeEmail(emailInput);
  const purpose = String(purposeInput || 'signup').trim() || 'signup';
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  if (purpose === 'signup') {
    const accounts = await readUserAccounts();
    if (accounts.some((account) => normalizeEmail(account.email || '') === email)) {
      const error = new Error('Email is already registered.');
      error.status = 409;
      error.details = { code: 'AUTH_EMAIL_DUPLICATE', field: 'email' };
      throw error;
    }
  }
  await assertLocalEmailVerificationSendAllowed(email, purpose);
  const now = new Date().toISOString();
  const record = {
    id: randomBytes(12).toString('base64url'),
    email,
    purpose,
    token: emailVerificationCode(),
    status: 'pending',
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(Date.now() + emailVerificationConfig.expiresMs).toISOString(),
  };
  record.delivery = await deliverEmailVerification(record);
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
    const candidates = records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => normalizeEmail(record.email) === email && ['pending', 'confirmed'].includes(String(record.status || 'pending')))
      .sort((left, right) => Date.parse(right.record.createdAt || '') - Date.parse(left.record.createdAt || ''));
    let mutated = false;
    let latestPending = null;
    for (const { record, index } of candidates) {
      const expiresAt = Date.parse(record.expiresAt || '');
      if (expiresAt && expiresAt < Date.now()) {
        records[index] = { ...record, status: 'expired', confirmedAt: '' };
        mutated = true;
        continue;
      }
      if (Number(record.attempts || 0) >= emailVerificationConfig.maxAttempts) {
        records[index] = { ...record, status: 'blocked' };
        mutated = true;
        continue;
      }
      if (!latestPending && String(record.status || 'pending') === 'pending') latestPending = { record, index };
      if (String(record.token || '') !== token) continue;
      if (String(record.status || '') === 'confirmed') return publicEmailVerification({ ...record, token: '' });
      const confirmed = { ...record, status: 'confirmed', confirmedAt: new Date().toISOString() };
      records[index] = confirmed;
      await writeJsonlRecords(emailVerificationsFile, records);
      return publicEmailVerification({ ...confirmed, token: '' });
    }
    if (latestPending) {
      records[latestPending.index] = {
        ...latestPending.record,
        attempts: Number(latestPending.record.attempts || 0) + 1,
      };
      mutated = true;
    }
    if (mutated) await writeJsonlRecords(emailVerificationsFile, records);
    const error = new Error('Email verification token is invalid.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_INVALID' };
    throw error;
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
  const token = String(input.token || input.verificationToken || '').trim();
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
  if (!token && !await hasConfirmedEmailVerification(email)) {
    const error = new Error('Email verification is required before signup.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
    throw error;
  }
  if (token) {
    const verification = await confirmEmailVerification({ email, token });
    if (verification.purpose !== 'signup') {
      const error = new Error('Email verification token is invalid.');
      error.status = 403;
      error.details = { code: 'EMAIL_VERIFICATION_INVALID' };
      throw error;
    }
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
      status: 'active',
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
      status: 'active',
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
  assertAccountActive(user, 'login');
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

async function buildGoogleAccountLoginUrl(req, input = {}) {
  const clientId = googleAccountClientId();
  if (!clientId) {
    const error = new Error('Google login is not configured.');
    error.status = 503;
    error.details = { code: 'GOOGLE_AUTH_NOT_CONFIGURED' };
    throw error;
  }
  const state = signGoogleAccountState({
    projectId: safeId(input.projectId || '', ''),
    next: safeGoogleAccountNext(input.next || '/'),
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', googleAccountRedirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
}

async function handleGoogleAccountCallback(req, res) {
  try {
    const url = new URL(req.url, googleRequestOrigin(req));
    const code = String(url.searchParams.get('code') || '').trim();
    const state = String(url.searchParams.get('state') || '').trim();
    if (!code || !state) {
      sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
      return;
    }
    const result = await loginGoogleAccountFromCode(req, { code, state });
    sendGoogleAuthSuccessHtml(res, result);
  } catch (error) {
    sendGoogleAuthFailureHtml(res, error);
  }
}

async function loginGoogleAccountFromCode(req, input = {}) {
  const statePayload = verifyGoogleAccountState(input.state || '');
  if (!input.code || !statePayload) {
    const error = new Error('Google login request is invalid.');
    error.status = 400;
    error.details = { code: 'GOOGLE_AUTH_INVALID' };
    throw error;
  }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: input.code,
      client_id: googleAccountClientId(),
      client_secret: googleAccountClientSecret(),
      redirect_uri: googleAccountRedirectUri(req),
      grant_type: 'authorization_code',
    }),
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    const error = new Error(token.error_description || token.error || 'Google token exchange failed.');
    error.status = 502;
    error.details = { code: 'GOOGLE_TOKEN_EXCHANGE_FAILED' };
    throw error;
  }
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok) {
    const error = new Error(profile.error_description || profile.error || 'Google profile request failed.');
    error.status = 502;
    error.details = { code: 'GOOGLE_PROFILE_FAILED' };
    throw error;
  }
  const email = normalizeEmail(profile.email || '');
  if (!isValidEmail(email) || profile.email_verified === false) {
    const error = new Error('Google account email is not verified.');
    error.status = 403;
    error.details = { code: 'GOOGLE_EMAIL_NOT_VERIFIED' };
    throw error;
  }
  const user = await upsertGoogleAccountUser({
    email,
    name: String(profile.name || profile.given_name || email).trim(),
  });
  const publicUser = authUserPublic(user);
  return {
    user: publicUser,
    session: createSessionToken({
      ownerId: publicUser.ownerId,
      projectId: safeId(statePayload.projectId || '', ''),
      role: 'master',
      email: publicUser.email,
    }),
    next: safeGoogleAccountNext(statePayload.next || '/'),
  };
}

async function upsertGoogleAccountUser(profile = {}) {
  const email = normalizeEmail(profile.email || '');
  const now = new Date().toISOString();
  if (storageRuntime.active === 'd1') {
    let user = await getD1AccountByEmail(storageRuntime.d1, email);
    if (user) {
      assertAccountActive(user, 'google login');
      if (user.emailVerified !== true || !user.name) {
        user = await upsertD1Account(storageRuntime.d1, {
          ...user,
          email,
          name: user.name || profile.name || email,
          emailVerified: true,
          emailVerifiedAt: now,
          updatedAt: now,
        });
      }
      return user;
    }
    const ownerId = ownerIdForEmail(email);
    return upsertD1Account(storageRuntime.d1, {
      id: ownerId,
      ownerId,
      name: profile.name || email,
      email,
      phone: '',
      phoneVerified: false,
      emailVerified: true,
      passwordHash: '',
      status: 'active',
      source: 'google',
      createdAt: now,
      updatedAt: now,
    });
  }

  return withJsonlMutex(usersFile, async () => {
    const users = await readUserAccounts();
    const index = users.findIndex((user) => normalizeEmail(user.email) === email);
    if (index >= 0) {
      assertAccountActive(users[index], 'google login');
      const nextUser = {
        ...users[index],
        name: users[index].name || profile.name || email,
        emailVerified: true,
        emailVerifiedAt: users[index].emailVerifiedAt || now,
        updatedAt: now,
      };
      users[index] = nextUser;
      await writeJsonlRecords(usersFile, users);
      return nextUser;
    }
    const ownerId = ownerIdForEmail(email);
    const user = {
      id: ownerId,
      ownerId,
      name: profile.name || email,
      email,
      phone: '',
      phoneVerified: false,
      emailVerified: true,
      emailVerifiedAt: now,
      passwordHash: '',
      status: 'active',
      source: 'google',
      createdAt: now,
      updatedAt: now,
    };
    await appendJsonlRecord(usersFile, user);
    return user;
  });
}

function googleAccountClientId() {
  return String(env.GOOGLE_AUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID || '').trim();
}

function googleAccountClientSecret() {
  return String(env.GOOGLE_AUTH_CLIENT_SECRET || env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || '').trim();
}

function googleAccountRedirectUri(req) {
  const configured = String(env.GOOGLE_AUTH_REDIRECT_URI || '').trim();
  if (configured) return configured;
  return new URL('/api/auth/login', googleRequestOrigin(req)).toString();
}

function signGoogleAccountState(payload = {}) {
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  })).toString('base64url');
  return `${body}.${createHmac('sha256', sessionAuthConfig.secret || 'pagero-dev-session').update(body).digest('base64url')}`;
}

function verifyGoogleAccountState(state = '') {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', sessionAuthConfig.secret || 'pagero-dev-session').update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sendGoogleAuthSuccessHtml(res, result = {}) {
  const authUser = {
    ...(result.user || {}),
    session: result.session || '',
    role: 'master',
    signedAt: new Date().toISOString(),
  };
  const next = safeGoogleAccountNext(result.next || '/');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google 로그인 완료</title></head>
<body>
<script>
try {
  localStorage.setItem('inlet-auth-v1', ${JSON.stringify(JSON.stringify(authUser))});
  location.replace(${JSON.stringify(next)});
} catch (error) {
  location.replace('/');
}
</script>
</body>
</html>`);
}

function sendGoogleAuthFailureHtml(res, error) {
  const message = escapeHtml(String(error?.message || error || 'Google 로그인에 실패했습니다.'));
  res.writeHead(Number(error?.status || 400), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google 로그인 실패</title></head>
<body style="margin:0;background:#f3f6fb;font-family:Arial,'Malgun Gothic',sans-serif;color:#101828;display:grid;min-height:100vh;place-items:center;">
  <section style="width:min(440px,calc(100% - 32px));background:#fff;border:1px solid #dbe4f0;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.12);text-align:center;">
    <strong style="display:inline-block;padding:7px 12px;border-radius:999px;background:#eef4ff;color:#2563eb;font-size:13px;">페이지로</strong>
    <h1 style="margin:18px 0 8px;font-size:26px;">Google 로그인 실패</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">${message}</p>
    <a href="/login" style="display:block;height:48px;line-height:48px;border-radius:14px;background:#111827;color:#fff;text-decoration:none;font-weight:900;">로그인으로 돌아가기</a>
  </section>
</body>
</html>`);
}

function safeGoogleAccountNext(value = '/') {
  const pathValue = String(value || '/').trim();
  if (!pathValue || !pathValue.startsWith('/') || pathValue.startsWith('//') || /^\/api(?:\/|$)/.test(pathValue)) return '/';
  return pathValue;
}

function googleRequestOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost').trim();
  const proto = String(req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https')).trim();
  return `${proto}://${host}`;
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
  assertAccountActive(user, 'refresh session');
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
    assertAccountActive(current, 'update account');
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
    assertAccountActive(users[index], 'update account');
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

async function updateUserAccountStatus(req, input = {}) {
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
  const status = normalizeAccountStatus(input.status || input.accountStatus || '');
  if (!['suspended', 'deleted_pending_retention'].includes(status)) {
    const error = new Error('Only suspended or deleted-pending-retention status can be set through this endpoint.');
    error.status = 400;
    error.details = { code: 'AUTH_ACCOUNT_STATUS_INVALID' };
    throw error;
  }

  const now = new Date().toISOString();
  const statusPatch = {
    status,
    ...(status === 'suspended' ? { suspendedAt: now } : {}),
    ...(status === 'deleted_pending_retention' ? { deletedAt: now } : {}),
    updatedAt: now,
  };

  if (storageRuntime.active === 'd1') {
    const current = email ? await getD1AccountByEmail(storageRuntime.d1, email) : null;
    if (!current || (ownerId && safeId(current.ownerId || current.id, '') !== ownerId)) {
      const error = new Error('Session account was not found.');
      error.status = 404;
      error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
      throw error;
    }
    assertAccountActive(current, 'update account status');
    const updated = await upsertD1Account(storageRuntime.d1, {
      ...current,
      ...statusPatch,
    });
    return { user: authUserPublic(updated), session: '' };
  }

  return withFileLock(usersFile, async () => {
    const users = await readUserAccounts();
    const index = users.findIndex((user) => (email && normalizeEmail(user.email) === email) || (ownerId && safeId(user.ownerId || user.id, '') === ownerId));
    if (index < 0) {
      const error = new Error('Account not found.');
      error.status = 404;
      error.details = { code: 'AUTH_ACCOUNT_NOT_FOUND' };
      throw error;
    }
    assertAccountActive(users[index], 'update account status');
    const nextUser = {
      ...users[index],
      ...statusPatch,
    };
    const nextUsers = users.slice();
    nextUsers[index] = nextUser;
    await writeJsonlRecords(usersFile, nextUsers);
    return { user: authUserPublic(nextUser), session: '' };
  });
}

async function changeUserPassword(input = {}) {
  const email = normalizeEmail(input.email || '');
  const password = String(input.password || '');
  const token = String(input.token || input.verificationToken || '').trim();
  if (!isValidEmail(email)) {
    const error = new Error('Valid email is required.');
    error.status = 400;
    error.details = { code: 'AUTH_EMAIL_REQUIRED' };
    throw error;
  }
  if (!token) {
    const error = new Error('Email verification is required before changing password.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_REQUIRED' };
    throw error;
  }
  const verification = await confirmEmailVerification({ email, token });
  if (verification.purpose !== 'password-reset') {
    const error = new Error('Email verification token is invalid.');
    error.status = 403;
    error.details = { code: 'EMAIL_VERIFICATION_INVALID' };
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
    assertAccountActive(user, 'change password');
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
    assertAccountActive(users[index], 'change password');
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

function normalizeManagerStatus(value = '') {
  return String(value || 'active') === 'active' ? 'active' : 'removed';
}

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
        status: normalizeManagerStatus(manager?.status),
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
  const ownerIds = identityOwnerAliases(identity);
  if (!ownerIds.size) return null;
  const managers = Array.isArray(access.managers) ? access.managers : [];
  return managers.find((manager) => manager.status === 'active' && ownerIds.has(String(manager.ownerId || ''))) || null;
}

function canAccessProject(identity = {}, access = {}, options = {}) {
  const ownerIds = identityOwnerAliases(identity);
  if (!ownerIds.size) return false;
  const role = String(identity.role || '').trim().toLowerCase().replace(/[-\s]/g, '_');
  if (ownerIds.has(safeId(access.ownerId, ''))) return true;
  if (isPublicProjectOwner(access.ownerId) && ['master', 'owner', 'builder'].includes(role)) return true;
  if (access.clientAccess && Array.isArray(access.clientOwnerIds) && access.clientOwnerIds.some((id) => ownerIds.has(safeId(id, '')))) return true;
  const manager = managerAccessForIdentity(identity, access);
  if (!manager) return false;
  const tab = String(options.tab || '').trim();
  if (!tab) return true;
  const permission = manager.access?.[tab] || {};
  return options.write ? !!permission.write : !!(permission.read || permission.write);
}

function identityOwnerAliases(identity = {}) {
  const aliases = new Set();
  const ownerId = safeId(identity.ownerId || '', '');
  const emailOwnerId = ownerIdForEmail(identity.email || '');
  if (ownerId) aliases.add(ownerId);
  if (emailOwnerId) aliases.add(emailOwnerId);
  return aliases;
}

function sameOwnerIdentity(identity = {}, project = {}) {
  const projectOwnerId = safeId(project.ownerId || project.ownerAccountId || '', '');
  if (!projectOwnerId) return true;
  return identityOwnerAliases(identity).has(projectOwnerId);
}

function isPublicProjectOwner(ownerId = '') {
  return safeId(ownerId, '').startsWith('public_');
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
        status: normalizeManagerStatus(manager.status),
        access: normalizeManagerAccess(manager.access || {}),
      })).filter((manager) => manager.ownerId && manager.email)
      : [],
    invites: Array.isArray(access.invites)
      ? access.invites.map(normalizeInvite).filter((invite) => invite.email && invite.ownerId && invite.token)
      : [],
    updatedAt: new Date().toISOString(),
  };
  await writeFile(file, JSON.stringify(next, null, 2), 'utf8');
  await syncD1ProjectAccess(normalizeProject(project), next);
  return next;
}

async function syncD1ProjectAccess(project = {}, access = {}) {
  if (storageRuntime.active !== 'd1' || !hasProject(project)) return null;
  const normalizedProject = normalizeProject(project);
  const ownerId = safeId(access.ownerId || normalizedProject.ownerId, normalizedProject.ownerId);
  const clientOwnerIds = Array.isArray(access.clientOwnerIds)
    ? access.clientOwnerIds.map((id) => safeId(id, '')).filter(Boolean)
    : [];
  const managers = Array.isArray(access.managers) ? access.managers : [];
  try {
    await upsertD1Project(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      ownerId,
      slug: normalizedProject.slug,
      title: access.title || normalizedProject.slug,
      clientEmail: normalizeEmail(access.clientEmail || ''),
      updatedAt: access.updatedAt || new Date().toISOString(),
    }, {
      projectId: normalizedProject.projectId,
      ownerId,
      slug: normalizedProject.slug,
    });
    const members = [
      ...(ownerId ? [{
        id: `${normalizedProject.projectId}-master`,
        ownerId,
        role: 'master',
        access: {},
        status: 'active',
      }] : []),
      ...clientOwnerIds.map((clientOwnerId) => ({
        id: `${normalizedProject.projectId}-client-${clientOwnerId}`,
        ownerId: clientOwnerId,
        role: 'client_admin',
        access: {},
        status: access.clientAccess === false ? 'removed' : 'active',
        invitedByAccountId: ownerId || null,
      })),
      ...managers.map((manager) => ({
        id: manager.id || manager.ownerId,
        ownerId: safeId(manager.ownerId || ownerIdForEmail(manager.email), ''),
        role: 'manager',
        access: normalizeManagerAccess(manager.access || {}),
        status: normalizeManagerStatus(manager.status),
        invitedByAccountId: ownerId || null,
      })).filter((manager) => manager.ownerId),
    ];
    return replaceD1ProjectMembers(storageRuntime.d1, {
      projectId: normalizedProject.projectId,
      roles: ['master', 'client_admin', 'manager'],
      members,
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.code || error?.message || 'D1_PROJECT_ACCESS_SYNC_FAILED',
    };
  }
}

async function authorizeProjectAccess(req, project = {}, options = {}) {
  if (!projectAuthConfig.enforce || !hasProject(project)) return hasProject(project) ? normalizeProject(project) : {};
  const normalizedProject = normalizeProject(project);
  const identity = requestIdentity(req);
  if (options.publicSubmit && !identity.ownerId) return normalizedProject;
  if (!identity.ownerId) throw accessError('Project owner identity is required.', 'PROJECT_ACCESS_REQUIRED');
  const role = String(identity.role || '').trim().toLowerCase().replace(/[-\s]/g, '_');
  const masterRole = ['master', 'owner', 'builder'].includes(role);
  const masterSameOwner = ['master', 'owner', 'builder'].includes(role) && sameOwnerIdentity(identity, normalizedProject);
  if (identity.projectId && identity.projectId !== normalizedProject.projectId && !masterSameOwner && !masterRole) {
    throw accessError('Project identity does not match the requested project.', 'PROJECT_ACCESS_MISMATCH');
  }

  const access = await readProjectAccess(normalizedProject);
  if (access) {
    if (!canAccessProject(identity, access, options)) throw accessError(options.write ? 'Project write access denied.' : 'Project access denied.');
    if (options.write && masterRole && isPublicProjectOwner(access.ownerId)) {
      await writeProjectAccess(normalizedProject, {
        ...access,
        ownerId: safeId(identity.ownerId, ''),
        ownerEmail: normalizeEmail(identity.email || access.ownerEmail || ''),
      });
    }
    return normalizedProject;
  }

  if (!sameOwnerIdentity(identity, normalizedProject)) {
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

function managerAuditKey(manager = {}) {
  return safeId(manager.ownerId || ownerIdForEmail(manager.email) || manager.id, '');
}

function normalizedAccessSignature(access = {}) {
  return JSON.stringify(normalizeManagerAccess(access || {}));
}

async function writeManagerAccessAudit(req, project = {}, previousAccess = {}, nextAccess = {}) {
  const normalizedProject = normalizeProject(project);
  const previousManagers = Array.isArray(previousAccess?.managers) ? previousAccess.managers.map((manager) => ({
    ...manager,
    email: normalizeEmail(manager.email || ''),
    ownerId: safeId(manager.ownerId || ownerIdForEmail(manager.email), ''),
    status: normalizeManagerStatus(manager.status),
    access: normalizeManagerAccess(manager.access || {}),
  })) : [];
  const nextManagers = Array.isArray(nextAccess?.managers) ? nextAccess.managers.map((manager) => ({
    ...manager,
    email: normalizeEmail(manager.email || ''),
    ownerId: safeId(manager.ownerId || ownerIdForEmail(manager.email), ''),
    status: normalizeManagerStatus(manager.status),
    access: normalizeManagerAccess(manager.access || {}),
  })) : [];
  const previousByKey = new Map(previousManagers.map((manager) => [managerAuditKey(manager), manager]));
  const nextByKey = new Map(nextManagers.map((manager) => [managerAuditKey(manager), manager]));
  const writes = [];

  for (const next of nextManagers) {
    const key = managerAuditKey(next);
    if (!key) continue;
    const previous = previousByKey.get(key);
    if (!previous) continue;
    if (previous.status === 'active' && next.status !== 'active') {
      writes.push(writeAuditLog(req, {
        projectId: normalizedProject.projectId,
        action: 'manager.removed',
        targetType: 'manager',
        targetId: key,
        metadata: { email: next.email, status: next.status },
      }));
      continue;
    }
    if (previous.status !== next.status || normalizedAccessSignature(previous.access) !== normalizedAccessSignature(next.access)) {
      writes.push(writeAuditLog(req, {
        projectId: normalizedProject.projectId,
        action: 'manager.permission_changed',
        targetType: 'manager',
        targetId: key,
        metadata: {
          email: next.email,
          previousStatus: previous.status,
          nextStatus: next.status,
          previousAccess: previous.access,
          nextAccess: next.access,
        },
      }));
    }
  }

  for (const previous of previousManagers) {
    const key = managerAuditKey(previous);
    if (!key || previous.status !== 'active' || nextByKey.has(key)) continue;
    writes.push(writeAuditLog(req, {
      projectId: normalizedProject.projectId,
      action: 'manager.removed',
      targetType: 'manager',
      targetId: key,
      metadata: { email: previous.email, status: 'removed' },
    }));
  }

  await Promise.all(writes);
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
  const updated = await writeProjectAccess(normalizedProject, { ...current, ...next, clientOwnerIds, managerOwnerIds });
  if (current) await writeManagerAccessAudit(req, normalizedProject, current, updated);
  return updated;
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

async function createManagerInvite(req, project = {}, manager = {}) {
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
  await writeAuditLog(req, {
    projectId: normalizedProject.projectId,
    action: 'manager.invite_created',
    targetType: 'manager_invite',
    targetId: invite.id,
    metadata: { email: invite.email, access: invite.access, expiresAt: invite.expiresAt },
  });
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
    status: normalizeManagerStatus(manager.status),
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
    billingPolicy: '결제가 진행 중이면 만료 또는 해지 후 최종 승인됩니다. 이후 새 소유자 계정의 카드로 결제할 수 있게 연결합니다.',
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
    status: normalizeManagerStatus(manager.status),
    access: normalizeManagerAccess(manager.access || {}),
  })) : [];
  const managerId = String(input.managerId || input.targetManagerId || input.id || '').trim();
  const managerEmail = normalizeEmail(input.managerEmail || input.email || '');
  const selected = managers.find((manager) => (
    manager.status === 'active'
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
      status: normalizeManagerStatus(manager.status),
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

async function buildMasterAdminSummary() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const users = await readUserAccounts().catch(() => []);
  const accessEntries = await allProjectAccessEntries();
  const rootPages = await fallbackRootPages();
  const projects = [];

  for (const entry of accessEntries) {
    const project = normalizeProject(entry.project || {});
    const access = entry.access || {};
    if (!isOperationalMasterProject(access.slug || project.slug || project.projectId)) continue;
    const pages = await readProjectPages(project);
    const primaryPage = pages[0] || {};
    const leads = await readLeadList(project).catch(() => []);
    const events = await readJsonlRecords(projectEventsFile(project) || path.join(dataDir, 'events.jsonl')).then((result) => result.records).catch(() => []);
    const blocked = await readJsonlRecords(projectBlockedLeadsFile(project) || path.join(dataDir, 'blocked-leads.jsonl')).then((result) => result.records).catch(() => []);
    const owner = users.find((user) => safeId(user.ownerId || user.id, '') === safeId(access.ownerId || project.ownerId, '')) || {};
    const usage = pages.reduce((sum, pageItem) => mergeFileUsage(sum, fileUsageFromPage(pageItem)), { fileCount: 0, fileBytes: 0, usesFileWidget: false });
    const pageViews = events.filter((event) => event.type === 'page_view' || event.eventType === 'page_view').length;
    const ctaClicks = events.filter((event) => event.type === 'cta_click' || event.eventType === 'cta_click').length;
    const downloadCount = events.filter((event) => event.type === 'file_download_click' || event.eventType === 'file_download_click').length;
    projects.push({
      id: project.projectId,
      slug: access.slug || project.slug || primaryPage.slug || '',
      title: primaryPage.title || access.title || access.slug || project.slug || project.projectId,
      ownerId: access.ownerId || project.ownerId || '',
      ownerEmail: publicOwnerLabel(owner.email || access.ownerEmail || access.clientEmail || primaryPage.clientEmail || ''),
      plan: primaryPage.plan || access.plan || 'free',
      billingStatus: primaryPage.billingStatus || access.billingStatus || 'trial',
      status: primaryPage.status || access.status || 'active',
      ...domainInfoFromPage(primaryPage),
      pageCount: Math.max(1, pages.length),
      totalLeads: leads.length,
      todayLeads: leads.filter((lead) => dateKey(lead.createdAt || lead.savedAt) === today).length,
      monthLeads: leads.filter((lead) => dateKey(lead.createdAt || lead.savedAt).slice(0, 7) === month).length,
      blockedLeads: blocked.length,
      lastLeadAt: leads.map((lead) => String(lead.createdAt || lead.savedAt || '')).sort().pop() || '',
      pageViews,
      ctaClicks,
      fileCount: usage.fileCount,
      fileBytes: usage.fileBytes,
      downloadCount,
      usesFileWidget: usage.usesFileWidget,
      uploadAllowed: isPaidMasterProject({ plan: primaryPage.plan || access.plan, billingStatus: primaryPage.billingStatus || access.billingStatus }),
      createdAt: primaryPage.createdAt || access.createdAt || '',
      updatedAt: primaryPage.updatedAt || primaryPage.lastSavedAt || access.updatedAt || '',
    });
  }

  for (const pageItem of rootPages) {
    if (projects.some((project) => project.slug && project.slug === pageItem.slug)) continue;
    if (!isOperationalMasterProject(pageItem.slug || pageItem.projectId || pageItem.title)) continue;
    const usage = fileUsageFromPage(pageItem);
    projects.push({
      id: pageItem.projectId || pageItem.slug || 'root-page',
      slug: pageItem.slug || '',
      title: pageItem.title || pageItem.slug || '랜딩페이지',
      ownerEmail: publicOwnerLabel(pageItem.clientEmail || ''),
      plan: pageItem.plan || 'free',
      billingStatus: pageItem.billingStatus || 'trial',
      status: pageItem.status || 'active',
      ...domainInfoFromPage(pageItem),
      pageCount: 1,
      totalLeads: 0,
      todayLeads: 0,
      monthLeads: 0,
      blockedLeads: 0,
      pageViews: 0,
      ctaClicks: 0,
      fileCount: usage.fileCount,
      fileBytes: usage.fileBytes,
      downloadCount: 0,
      usesFileWidget: usage.usesFileWidget,
      uploadAllowed: isPaidMasterProject(pageItem),
      createdAt: pageItem.createdAt || '',
      updatedAt: pageItem.updatedAt || pageItem.lastSavedAt || '',
    });
  }

  const operationalProjects = projects.filter((project) => isOperationalMasterProject(project.slug || project.id || project.title));
  const accounts = buildMasterAccounts(users, operationalProjects);
  const files = operationalProjects.filter((project) => project.usesFileWidget || Number(project.fileCount || 0) > 0);
  const paidProjects = operationalProjects.filter(isPaidMasterProject).length;
  const paidAccounts = accounts.filter((account) => Number(account.paidProjectCount || 0) > 0 || isPaidMasterProject(account)).length;

  return {
    summary: {
      accounts: accounts.length,
      paidAccounts,
      freeAccounts: Math.max(0, accounts.length - paidAccounts),
      projects: operationalProjects.length,
      activeProjects: operationalProjects.filter((project) => String(project.status || '') !== 'archived').length,
      paidProjects,
      freeProjects: Math.max(0, operationalProjects.length - paidProjects),
      leads: operationalProjects.reduce((sum, project) => sum + Number(project.totalLeads || 0), 0),
      todayLeads: operationalProjects.reduce((sum, project) => sum + Number(project.todayLeads || 0), 0),
      monthLeads: operationalProjects.reduce((sum, project) => sum + Number(project.monthLeads || 0), 0),
      blockedLeads: operationalProjects.reduce((sum, project) => sum + Number(project.blockedLeads || 0), 0),
      pageViews: operationalProjects.reduce((sum, project) => sum + Number(project.pageViews || 0), 0),
      ctaClicks: operationalProjects.reduce((sum, project) => sum + Number(project.ctaClicks || 0), 0),
      filePages: files.length,
      fileBytes: files.reduce((sum, project) => sum + Number(project.fileBytes || 0), 0),
      fileDownloads: files.reduce((sum, project) => sum + Number(project.downloadCount || 0), 0),
      managerMembers: accounts.reduce((sum, account) => sum + Number(account.managerCount || 0), 0),
      pendingInvites: transferQueueCount(operationalProjects, 'pendingInvites'),
      failedDeliveries: transferQueueCount(operationalProjects, 'failedDeliveries'),
      retryableDeliveries: transferQueueCount(operationalProjects, 'retryableDeliveries'),
      activeAiKeys: 0,
      aiDrafts: 0,
      pendingOwnershipTransfers: 0,
      auditLogs: 0,
    },
    accounts,
    projects: operationalProjects.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 200),
    leadSummary: operationalProjects
      .map((project) => ({
        id: project.id,
        slug: project.slug,
        title: project.title,
        ownerEmail: project.ownerEmail,
        totalLeads: project.totalLeads,
        todayLeads: project.todayLeads,
        monthLeads: project.monthLeads,
        blockedLeads: project.blockedLeads,
        lastLeadAt: project.lastLeadAt,
      }))
      .sort((a, b) => Number(b.monthLeads || b.totalLeads || 0) - Number(a.monthLeads || a.totalLeads || 0)),
    files: files.sort((a, b) => Number(b.fileBytes || 0) - Number(a.fileBytes || 0)),
  };
}

function buildMasterAccounts(users = [], projects = []) {
  const byEmail = new Map();
  for (const user of users) {
    const email = normalizeEmail(user.email || '');
    if (isPublicShellEmail(email) || isTestEmail(email)) continue;
    if (!email) continue;
    byEmail.set(email, {
      id: safeId(user.ownerId || user.id, ''),
      email,
      name: String(user.name || user.email || '').trim(),
      status: user.status || 'active',
      plan: user.plan || 'free',
      billingStatus: user.billingStatus || 'trial',
      projectCount: 0,
      paidProjectCount: 0,
      fileBytes: 0,
      createdAt: user.createdAt || '',
      updatedAt: user.updatedAt || '',
      lastActiveAt: user.updatedAt || user.createdAt || '',
    });
  }
  for (const project of projects) {
    const email = normalizeEmail(project.ownerEmail || '');
    if (!email.includes('@') || isPublicShellEmail(email) || isTestEmail(email)) continue;
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        id: `external_${stableHash(email)}`,
        email,
        name: email,
        status: 'active',
        plan: 'free',
        billingStatus: 'trial',
        projectCount: 0,
        paidProjectCount: 0,
        fileBytes: 0,
        createdAt: '',
        updatedAt: '',
        lastActiveAt: '',
      });
    }
    const account = byEmail.get(email);
    account.projectCount += 1;
    account.fileBytes += Number(project.fileBytes || 0);
    if (isPaidMasterProject(project)) {
      account.paidProjectCount += 1;
      account.plan = project.plan || 'paid';
      account.billingStatus = project.billingStatus || 'active';
    }
    if (String(project.updatedAt || '') > String(account.lastActiveAt || '')) account.lastActiveAt = project.updatedAt;
  }
  return [...byEmail.values()].sort((a, b) => String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || '')));
}

async function readProjectPages(project = {}) {
  const base = projectDir(project);
  if (!base) return [];
  const dir = path.join(base, 'pages');
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const pages = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      pages.push(JSON.parse(await readFile(path.join(dir, entry.name), 'utf8')));
    } catch {}
  }
  return pages;
}

async function fallbackRootPages() {
  let entries = [];
  try {
    entries = await readdir(pagesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const pages = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      pages.push(JSON.parse(await readFile(path.join(pagesDir, entry.name), 'utf8')));
    } catch {}
  }
  return pages;
}

function fileUsageFromPage(page = {}) {
  let fileCount = 0;
  let fileBytes = 0;
  let usesFileWidget = false;
  for (const block of Array.isArray(page.blocks) ? page.blocks : []) {
    if (block?.type !== 'download') continue;
    usesFileWidget = true;
    for (const item of Array.isArray(block.s?.items) ? block.s.items : []) {
      if (!item?.fileUrl) continue;
      fileCount += 1;
      fileBytes += Number(item.fileBytes || item.size || item.bytes || 0);
    }
  }
  return { fileCount, fileBytes, usesFileWidget };
}

function domainInfoFromPage(page = {}) {
  const customDomain = String(page.customDomain || page.url?.customDomain || page.domain?.customDomain || '').trim().toLowerCase();
  const domainType = String(page.domainType || page.url?.domainType || (customDomain ? 'custom' : 'default')).trim().toLowerCase() || 'default';
  const domainStatus = String(page.domainStatus || page.url?.domainStatus || (customDomain ? 'pending_dns' : 'ready')).trim().toLowerCase() || 'ready';
  return { domainType, customDomain, domainStatus };
}

function transferQueueCount(rows = [], key = '') {
  return rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function mergeFileUsage(left, right) {
  return {
    fileCount: Number(left.fileCount || 0) + Number(right.fileCount || 0),
    fileBytes: Number(left.fileBytes || 0) + Number(right.fileBytes || 0),
    usesFileWidget: !!left.usesFileWidget || !!right.usesFileWidget,
  };
}

function dateKey(value = '') {
  return String(value || '').slice(0, 10);
}

function isPaidMasterProject(project = {}) {
  const plan = String(project.plan || project.billingPlan || '').trim().toLowerCase();
  const billing = String(project.billingStatus || project.billing_status || '').trim().toLowerCase();
  return billing === 'active' || (plan && !['free', 'trial'].includes(plan));
}

function isPublicShellEmail(email = '') {
  return String(email || '').trim().toLowerCase().endsWith('@public.inlet.local');
}

function isTestEmail(email = '') {
  const value = String(email || '').trim().toLowerCase();
  return value.endsWith('@inlet.test') || value.startsWith('hosted-');
}

function isTestProjectSlug(value = '') {
  const text = String(value || '').trim().toLowerCase();
  return /^(hosted-route-qa-|route-qa-|live-[a-z0-9-]*qa-|live-public-stability-|smoke-|test-)/.test(text) || text.includes('-smoke-');
}

function isOperationalMasterProject(value = '') {
  const text = String(value || '').trim();
  return !!text && !isTestProjectSlug(text);
}

function publicOwnerLabel(email = '') {
  const value = normalizeEmail(email || '');
  return isPublicShellEmail(value) ? '소유자 미확인' : value;
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

async function acceptManagerInvite(req, token = '', body = {}) {
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
    if (String(body.authMode || '').toLowerCase() === 'signup' && !String(body.token || body.verificationToken || '').trim() && !await hasConfirmedEmailVerification(email)) {
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
        token: body.token || body.verificationToken || '',
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
    await writeAuditLog(req, {
      projectId: project.projectId,
      actorAccountId: accepted.ownerId,
      action: 'manager.invite_accepted',
      targetType: 'manager',
      targetId: accepted.ownerId,
      metadata: { email: accepted.email, inviteId: invite.id, access: accepted.access },
    });
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

function projectBlockedLeadsFile(project = {}) {
  const dir = projectDir(project);
  return dir ? path.join(dir, 'blocked-leads.jsonl') : '';
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

async function readPublicPage(slug) {
  const safe = safeSlug(slug);
  if (!safe) return null;
  if (storageRuntime.active === 'd1') {
    return getD1PublicPageBySlug(storageRuntime.d1, { slug: safe });
  }

  const direct = await readPage(safe, {});
  if (direct) return direct;

  let projectDirs = [];
  try {
    projectDirs = await readdir(path.join(dataDir, 'projects'), { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of projectDirs) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dataDir, 'projects', entry.name, 'pages', `${safe}.json`);
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {}
  }
  return null;
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
  const revisionId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomId()}`;
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

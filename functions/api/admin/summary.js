import { assertD1, handleApiError, jsonResponse, optionsResponse, sessionIdentity } from '../_shared.js';
import { projectDownloadsPrefix } from '../files/_files.js';

const ADMIN_METHODS = 'GET, OPTIONS';
const DEFAULT_MASTER_EMAILS = ['admin@pagero.kr', 'roadfor@kakao.com', 'pc9839a@naver.com'];
const OPERATIONAL_PROJECT_WHERE = `
  COALESCE(projects.status, 'active') <> 'deleted'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE 'hosted-route-qa-%'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE 'route-qa-%'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE 'live-%-qa-%'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE 'live-public-stability-%'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE '%-smoke-%'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE 'smoke-%'
  AND lower(COALESCE(projects.slug, '')) NOT LIKE 'test-%'
`;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, ADMIN_METHODS);
  if (request.method !== 'GET') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, ADMIN_METHODS);
  try {
    const db = assertD1(env);
    const identity = await sessionIdentity(request, env);
    assertPlatformMaster(identity, env);
    const snapshot = await buildD1MasterSummary(db, env);
    return jsonResponse(request, env, 200, {
      ok: true,
      mode: 'live',
      generatedAt: new Date().toISOString(),
      identity: { email: identity.email || '', role: identity.role || '' },
      ...snapshot,
    }, ADMIN_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, ADMIN_METHODS);
  }
}

function assertPlatformMaster(identity = null, env = {}) {
  const email = String(identity?.email || '').trim().toLowerCase();
  const role = String(identity?.role || '').trim().toLowerCase().replace(/[-\s]/g, '_');
  const emails = String(env.INLET_PLATFORM_MASTER_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowedEmails = emails.length ? emails : DEFAULT_MASTER_EMAILS;
  if (allowedEmails.includes(email) || ['platformmaster', 'platform_master', 'superadmin', 'serviceadmin'].includes(role)) return true;
  const error = new Error('전체 관리자 권한이 필요합니다.');
  error.status = identity ? 403 : 401;
  error.details = { code: 'PLATFORM_MASTER_REQUIRED' };
  throw error;
}

async function buildD1MasterSummary(db, env = {}) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const [accounts, projects, leadSummary, eventSummary, blockedSummary, opsSummary] = await Promise.all([
    listAccounts(db),
    listProjects(db, month, today),
    listLeadSummary(db, month, today),
    listEventSummary(db, month),
    listBlockedSummary(db, month, today),
    listOpsSummary(db),
  ]);

  const fileUsage = await listFileUsage(db, env, projects.map((project) => project.id));
  const projectPayments = await listProjectPaymentSummary(db);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  for (const row of leadSummary) Object.assign(projectById.get(row.id) || {}, row);
  for (const row of eventSummary) Object.assign(projectById.get(row.id) || {}, row);
  for (const row of blockedSummary) Object.assign(projectById.get(row.id) || {}, row);
  for (const row of fileUsage) Object.assign(projectById.get(row.id) || {}, row);
  for (const row of projectPayments) Object.assign(projectById.get(row.id) || {}, row);

  const enrichedProjects = projects.map((project) => ({
    ...project,
    totalLeads: Number(project.totalLeads || 0),
    todayLeads: Number(project.todayLeads || 0),
    monthLeads: Number(project.monthLeads || 0),
    blockedLeads: Number(project.blockedLeads || 0),
    pageViews: Number(project.pageViews || 0),
    ctaClicks: Number(project.ctaClicks || 0),
    fileCount: Number(project.fileCount || 0),
    fileBytes: Number(project.fileBytes || 0),
    downloadCount: Number(project.downloadCount || 0),
    paidAmount: Number(project.paidAmount || 0),
    paidPayments: Number(project.paidPayments || 0),
    lastPaymentAt: project.lastPaymentAt || '',
    usesFileWidget: !!project.usesFileWidget || Number(project.fileCount || 0) > 0,
    uploadAllowed: isPaidProject(project),
  }));

  const accountStats = accountRollup(accounts, enrichedProjects);
  const files = enrichedProjects
    .filter((project) => project.usesFileWidget || project.fileCount > 0)
    .sort((a, b) => Number(b.fileBytes || 0) - Number(a.fileBytes || 0));

  const paidProjects = enrichedProjects.filter(isPaidProject).length;
  const paidAccounts = accountStats.filter((account) => Number(account.paidProjectCount || 0) > 0 || isPaidAccount(account)).length;

  return {
    summary: {
      accounts: accounts.length,
      paidAccounts,
      freeAccounts: Math.max(0, accounts.length - paidAccounts),
      projects: enrichedProjects.length,
      activeProjects: enrichedProjects.filter((project) => String(project.status || '') !== 'archived').length,
      paidProjects,
      freeProjects: Math.max(0, enrichedProjects.length - paidProjects),
      leads: enrichedProjects.reduce((sum, project) => sum + Number(project.totalLeads || 0), 0),
      todayLeads: enrichedProjects.reduce((sum, project) => sum + Number(project.todayLeads || 0), 0),
      monthLeads: enrichedProjects.reduce((sum, project) => sum + Number(project.monthLeads || 0), 0),
      blockedLeads: enrichedProjects.reduce((sum, project) => sum + Number(project.blockedLeads || 0), 0),
      pageViews: enrichedProjects.reduce((sum, project) => sum + Number(project.pageViews || 0), 0),
      ctaClicks: enrichedProjects.reduce((sum, project) => sum + Number(project.ctaClicks || 0), 0),
      filePages: files.length,
      fileBytes: files.reduce((sum, project) => sum + Number(project.fileBytes || 0), 0),
      fileDownloads: files.reduce((sum, project) => sum + Number(project.downloadCount || 0), 0),
      paidPayments: enrichedProjects.reduce((sum, project) => sum + Number(project.paidPayments || 0), 0),
      paidAmount: enrichedProjects.reduce((sum, project) => sum + Number(project.paidAmount || 0), 0),
      activeSubscriptions: enrichedProjects.filter((project) => String(project.billingStatus || '').toLowerCase() === 'active').length,
      pastDueSubscriptions: enrichedProjects.filter((project) => String(project.billingStatus || '').toLowerCase() === 'past_due').length,
      ...opsSummary,
    },
    accounts: accountStats.slice(0, 100),
    projects: enrichedProjects.slice(0, 200),
    leadSummary: enrichedProjects
      .map((project) => ({
        id: project.id,
        slug: project.slug,
        title: project.title,
        ownerEmail: project.ownerEmail,
        totalLeads: project.totalLeads,
        todayLeads: project.todayLeads,
        monthLeads: project.monthLeads,
        blockedLeads: project.blockedLeads,
        lastLeadAt: project.lastLeadAt || '',
      }))
      .sort((a, b) => Number(b.monthLeads || b.totalLeads || 0) - Number(a.monthLeads || a.totalLeads || 0)),
    files,
  };
}

async function listAccounts(db) {
  const result = await db.prepare(`
    SELECT id, email, name, status, created_at AS createdAt, updated_at AS updatedAt
    FROM accounts
    WHERE COALESCE(status, 'active') <> 'deleted'
      AND lower(email) NOT LIKE '%@public.inlet.local'
      AND lower(email) NOT LIKE '%@inlet.test'
      AND lower(email) NOT LIKE 'hosted-%'
    ORDER BY created_at DESC
    LIMIT 500
  `).all();
  return (result.results || [])
    .map((row) => ({
    id: row.id,
    email: row.email || '',
    name: row.name || '',
    status: row.status || 'active',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  }))
    .filter(isOperationalAccount);
}

async function listProjects(db, month, today) {
  const result = await db.prepare(`
    SELECT
      projects.id,
      projects.slug,
      projects.title,
      COALESCE(subscriptions.plan, projects.plan) AS plan,
      COALESCE(
        CASE
          WHEN subscriptions.status = 'active' THEN 'active'
          WHEN subscriptions.status = 'past_due' THEN 'past_due'
          WHEN subscriptions.status = 'canceled' THEN 'canceled'
          WHEN subscriptions.status = 'expired' THEN 'expired'
          ELSE NULL
        END,
        projects.billing_status
      ) AS billingStatus,
      projects.status,
      projects.created_at AS createdAt,
      projects.updated_at AS updatedAt,
      accounts.email AS ownerEmail,
      COUNT(DISTINCT pages.id) AS pageCount,
      (
        SELECT latest_pages.page_json
        FROM pages AS latest_pages
        WHERE latest_pages.project_id = projects.id
        ORDER BY latest_pages.updated_at DESC, latest_pages.revision DESC, latest_pages.id DESC
        LIMIT 1
      ) AS pageJson
    FROM projects
    LEFT JOIN accounts ON accounts.id = projects.owner_account_id
    LEFT JOIN pages ON pages.project_id = projects.id
    LEFT JOIN subscriptions ON subscriptions.project_id = projects.id
    WHERE ${OPERATIONAL_PROJECT_WHERE}
    GROUP BY projects.id
    ORDER BY projects.updated_at DESC
    LIMIT 500
  `).all();
  return (result.results || [])
    .map((row) => ({
      id: row.id,
      slug: row.slug || '',
      title: row.title || row.slug || row.id,
      ownerEmail: publicOwnerLabel(row.ownerEmail || ''),
      plan: row.plan || 'free',
      billingStatus: row.billingStatus || 'trial',
      status: row.status || 'active',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
      pageCount: Number(row.pageCount || 0),
      month,
      today,
      ...domainInfoFromPageJson(row.pageJson || ''),
    }))
    .filter(isOperationalProject);
}

async function listOpsSummary(db) {
  const empty = {
    managerMembers: 0,
    pendingInvites: 0,
    failedDeliveries: 0,
    retryableDeliveries: 0,
    activeAiKeys: 0,
    aiDrafts: 0,
    pendingOwnershipTransfers: 0,
    auditLogs: 0,
  };
  try {
    const [
      managerMembers,
      pendingInvites,
      failedDeliveries,
      retryableDeliveries,
      activeAiKeys,
      aiDrafts,
      pendingOwnershipTransfers,
      auditLogs,
    ] = await Promise.all([
      countTable(db, `SELECT COUNT(*) AS count FROM project_members LEFT JOIN projects ON projects.id = project_members.project_id WHERE ${OPERATIONAL_PROJECT_WHERE} AND project_members.status IN ('active', 'pending')`),
      countTable(db, `SELECT COUNT(*) AS count FROM invites LEFT JOIN projects ON projects.id = invites.project_id WHERE ${OPERATIONAL_PROJECT_WHERE} AND invites.status = 'pending'`),
      countTable(db, `SELECT COUNT(*) AS count FROM delivery_logs LEFT JOIN projects ON projects.id = delivery_logs.project_id WHERE ${OPERATIONAL_PROJECT_WHERE} AND delivery_logs.status IN ('failed', 'timeout', 'dead-letter')`),
      countTable(db, `SELECT COUNT(*) AS count FROM delivery_logs LEFT JOIN projects ON projects.id = delivery_logs.project_id WHERE ${OPERATIONAL_PROJECT_WHERE} AND delivery_logs.retryable = 1`),
      countTable(db, `SELECT COUNT(*) AS count FROM ai_keys LEFT JOIN projects ON projects.id = ai_keys.project_id WHERE (ai_keys.project_id IS NULL OR ${OPERATIONAL_PROJECT_WHERE}) AND ai_keys.status = 'connected' AND ai_keys.deleted_at IS NULL`),
      countTable(db, `SELECT COUNT(*) AS count FROM ai_drafts LEFT JOIN projects ON projects.id = ai_drafts.project_id WHERE ${OPERATIONAL_PROJECT_WHERE} AND ai_drafts.status <> 'deleted'`),
      countTable(db, `SELECT COUNT(*) AS count FROM ownership_transfer_requests LEFT JOIN projects ON projects.id = ownership_transfer_requests.project_id WHERE ${OPERATIONAL_PROJECT_WHERE} AND ownership_transfer_requests.status IN ('requested', 'waiting_billing_clearance', 'approved')`),
      countTable(db, `SELECT COUNT(*) AS count FROM audit_logs LEFT JOIN projects ON projects.id = audit_logs.project_id WHERE audit_logs.project_id IS NULL OR ${OPERATIONAL_PROJECT_WHERE}`),
    ]);
    return { managerMembers, pendingInvites, failedDeliveries, retryableDeliveries, activeAiKeys, aiDrafts, pendingOwnershipTransfers, auditLogs };
  } catch {
    return empty;
  }
}

async function countTable(db, sql) {
  const row = await db.prepare(sql).first();
  return Number(row?.count || 0);
}

async function listLeadSummary(db, month, today) {
  const result = await db.prepare(`
    SELECT
      projects.id,
      COUNT(leads.id) AS totalLeads,
      SUM(CASE WHEN substr(leads.created_at, 1, 10) = ? THEN 1 ELSE 0 END) AS todayLeads,
      SUM(CASE WHEN leads.created_month = ? THEN 1 ELSE 0 END) AS monthLeads,
      MAX(leads.created_at) AS lastLeadAt
    FROM projects
    LEFT JOIN leads ON leads.project_id = projects.id
    WHERE ${OPERATIONAL_PROJECT_WHERE}
    GROUP BY projects.id
  `).bind(today, month).all();
  return (result.results || []).map(numberRow);
}

async function listEventSummary(db, month) {
  const result = await db.prepare(`
    SELECT
      projects.id,
      SUM(CASE WHEN events.event_type = 'page_view' AND events.created_month = ? THEN 1 ELSE 0 END) AS pageViews,
      SUM(CASE WHEN events.event_type = 'cta_click' AND events.created_month = ? THEN 1 ELSE 0 END) AS ctaClicks,
      SUM(CASE WHEN events.event_type = 'file_download_click' AND events.created_month = ? THEN 1 ELSE 0 END) AS downloadCount
    FROM projects
    LEFT JOIN events ON events.project_id = projects.id
    WHERE ${OPERATIONAL_PROJECT_WHERE}
    GROUP BY projects.id
  `).bind(month, month, month).all();
  return (result.results || []).map(numberRow);
}

async function listBlockedSummary(db, month, today) {
  try {
    const result = await db.prepare(`
      SELECT
        projects.id,
        COUNT(lead_blocked_submissions.id) AS blockedLeads,
        SUM(CASE WHEN substr(lead_blocked_submissions.created_at, 1, 10) = ? THEN 1 ELSE 0 END) AS todayBlockedLeads,
        SUM(CASE WHEN lead_blocked_submissions.created_month = ? THEN 1 ELSE 0 END) AS monthBlockedLeads
      FROM projects
      LEFT JOIN lead_blocked_submissions ON lead_blocked_submissions.project_id = projects.id
      WHERE ${OPERATIONAL_PROJECT_WHERE}
      GROUP BY projects.id
    `).bind(today, month).all();
    return (result.results || []).map(numberRow);
  } catch {
    return [];
  }
}

async function listPaymentSummary(db) {
  try {
    const row = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paidPayments,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paidAmount
      FROM payments
    `).first();
    return numberRow(row || {});
  } catch {
    return {};
  }
}

async function listProjectPaymentSummary(db) {
  try {
    const result = await db.prepare(`
      SELECT
        projects.id,
        SUM(CASE WHEN payments.status = 'paid' THEN 1 ELSE 0 END) AS paidPayments,
        SUM(CASE WHEN payments.status = 'paid' THEN payments.amount ELSE 0 END) AS paidAmount,
        MAX(CASE WHEN payments.status = 'paid' THEN COALESCE(payments.paid_at, payments.created_at) ELSE NULL END) AS lastPaymentAt
      FROM projects
      LEFT JOIN payments ON payments.project_id = projects.id
      WHERE ${OPERATIONAL_PROJECT_WHERE}
      GROUP BY projects.id
    `).all();
    return (result.results || []).map(numberRow);
  } catch {
    return [];
  }
}

async function listSubscriptionSummary(db) {
  try {
    const row = await db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeSubscriptions,
        SUM(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END) AS pastDueSubscriptions
      FROM subscriptions
    `).first();
    return numberRow(row || {});
  } catch {
    return {};
  }
}

async function listFileUsage(db, env = {}, projectIds = []) {
  const knownProjectIds = new Set(projectIds.filter(Boolean));
  const result = await db.prepare(`
    SELECT projects.id, pages.page_json AS pageJson
    FROM projects
    LEFT JOIN pages ON pages.project_id = projects.id
    WHERE ${OPERATIONAL_PROJECT_WHERE}
    ORDER BY pages.updated_at DESC
    LIMIT 1000
  `).all();
  const byProject = new Map();
  for (const row of result.results || []) {
    if (knownProjectIds.size && !knownProjectIds.has(row.id)) continue;
    const usage = fileUsageFromPageJson(row.pageJson || '');
    if (!usage.usesFileWidget && !usage.fileCount) continue;
    const current = byProject.get(row.id) || { id: row.id, fileCount: 0, fileBytes: 0, usesFileWidget: false };
    current.fileCount += usage.fileCount;
    current.fileBytes += usage.fileBytes;
    current.usesFileWidget = current.usesFileWidget || usage.usesFileWidget;
    byProject.set(row.id, current);
  }
  const r2Usage = await listR2FileUsage(env, projectIds);
  for (const row of r2Usage) {
    const current = byProject.get(row.id) || { id: row.id, fileCount: 0, fileBytes: 0, usesFileWidget: false };
    current.fileCount = Math.max(Number(current.fileCount || 0), Number(row.fileCount || 0));
    current.fileBytes = Math.max(Number(current.fileBytes || 0), Number(row.fileBytes || 0));
    current.usesFileWidget = current.usesFileWidget || Number(row.fileCount || 0) > 0;
    byProject.set(row.id, current);
  }
  return [...byProject.values()];
}

async function listR2FileUsage(env = {}, knownProjectIds = []) {
  const bucket = env.FILES_BUCKET || env.INLET_FILES_BUCKET || env.R2_FILES || env.FILES;
  if (!bucket || typeof bucket.list !== 'function') return [];
  const projectIds = new Set(knownProjectIds.filter(Boolean));
  const usage = new Map();
  let cursor = undefined;
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    for (const object of page.objects || []) {
      const key = String(object.key || object.name || '');
      const [projectId, folder] = key.split('/');
      if (!projectId || folder !== 'downloads') continue;
      if (projectIds.size && !projectIds.has(projectId)) continue;
      if (!key.startsWith(projectDownloadsPrefix(projectId))) continue;
      const current = usage.get(projectId) || { id: projectId, fileCount: 0, fileBytes: 0 };
      current.fileCount += 1;
      current.fileBytes += Number(object.size || 0);
      usage.set(projectId, current);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return [...usage.values()];
}

function fileUsageFromPageJson(pageJson = '') {
  try {
    const page = JSON.parse(pageJson || '{}');
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
  } catch {
    return { fileCount: 0, fileBytes: 0, usesFileWidget: false };
  }
}

function domainInfoFromPageJson(pageJson = '') {
  try {
    return domainInfoFromPage(JSON.parse(pageJson || '{}'));
  } catch {
    return domainInfoFromPage({});
  }
}

function domainInfoFromPage(page = {}) {
  const customDomain = String(page.customDomain || page.url?.customDomain || page.domain?.customDomain || '').trim().toLowerCase();
  const domainType = String(page.domainType || page.url?.domainType || (customDomain ? 'custom' : 'default')).trim().toLowerCase() || 'default';
  const domainStatus = String(page.domainStatus || page.url?.domainStatus || (customDomain ? 'pending_dns' : 'ready')).trim().toLowerCase() || 'ready';
  return { domainType, customDomain, domainStatus };
}

function accountRollup(accounts, projects) {
  const byOwner = new Map(accounts.map((account) => [account.id, {
    ...account,
    plan: 'free',
    billingStatus: 'trial',
    projectCount: 0,
    paidProjectCount: 0,
    fileBytes: 0,
    lastActiveAt: account.updatedAt || account.createdAt || '',
  }]));
  for (const project of projects) {
    const ownerEmail = String(project.ownerEmail || '').toLowerCase();
    if (!ownerEmail.includes('@') || isPublicShellEmail(ownerEmail) || isTestEmail(ownerEmail)) continue;
    const account = [...byOwner.values()].find((item) => String(item.email || '').toLowerCase() === ownerEmail);
    if (!account) continue;
    account.projectCount += 1;
    if (isPaidProject(project)) account.paidProjectCount += 1;
    account.fileBytes += Number(project.fileBytes || 0);
    if (String(project.updatedAt || '') > String(account.lastActiveAt || '')) account.lastActiveAt = project.updatedAt;
    if (isPaidProject(project)) {
      account.plan = project.plan || 'paid';
      account.billingStatus = project.billingStatus || 'active';
    }
  }
  return [...byOwner.values()].sort((a, b) => String(b.lastActiveAt || '').localeCompare(String(a.lastActiveAt || '')));
}

function isPaidProject(project = {}) {
  const plan = String(project.plan || '').toLowerCase();
  const billing = String(project.billingStatus || project.billing_status || '').toLowerCase();
  return billing === 'active' || (plan && !['free', 'trial'].includes(plan));
}

function isPaidAccount(account = {}) {
  const plan = String(account.plan || '').toLowerCase();
  const billing = String(account.billingStatus || account.billing_status || '').toLowerCase();
  return billing === 'active' || (plan && !['free', 'trial'].includes(plan));
}

function isPublicShellEmail(email = '') {
  return String(email || '').trim().toLowerCase().endsWith('@public.inlet.local');
}

function isOperationalAccount(account = {}) {
  const email = String(account.email || '').trim().toLowerCase();
  return !!email && !isPublicShellEmail(email) && !isTestEmail(email);
}

function isOperationalProject(project = {}) {
  return !isTestProjectSlug(project.slug || project.id || project.title);
}

function isTestEmail(email = '') {
  const value = String(email || '').trim().toLowerCase();
  return value.endsWith('@inlet.test') || value.startsWith('hosted-');
}

function isTestProjectSlug(value = '') {
  const text = String(value || '').trim().toLowerCase();
  return /^(hosted-route-qa-|route-qa-|live-[a-z0-9-]*qa-|live-public-stability-|smoke-|test-)/.test(text) || text.includes('-smoke-');
}

function publicOwnerLabel(email = '') {
  const value = String(email || '').trim().toLowerCase();
  return isPublicShellEmail(value) ? '소유자 미확인' : value;
}

function numberRow(row = {}) {
  const next = { ...row };
  for (const key of Object.keys(next)) {
    if (/count|leads|views|clicks|payments|amount|subscriptions|bytes|downloads/i.test(key)) {
      next[key] = Number(next[key] || 0);
    }
  }
  return next;
}

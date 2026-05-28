import { findD1LeadsByIntakeSignals, insertD1BlockedLeadSubmission, listD1Leads, upsertD1Lead } from '../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, monthFromRequest, optionsResponse, projectFromRequest, readJson } from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    const url = new URL(request.url);
    const db = assertD1(env);

    if (request.method === 'POST') {
      const body = await readJson(request);
      const project = projectFromRequest(url, body, request);
      await authorizeProject(request, env, project, { publicWrite: true });
      await ensureD1ProjectShell(db, project);
      const lead = body.lead && typeof body.lead === 'object' ? body.lead : body;
      const duplicatePolicy = await evaluateD1LeadDuplicatePolicy(db, project, body.page || {}, lead);
      if (duplicatePolicy.blocked) {
        await insertD1BlockedLeadSubmission(db, blockedLeadRecord(duplicatePolicy, lead, project, body.page || {}), {
          projectId: project.projectId,
          pageSlug: body.page?.slug || project.slug || lead.pageSlug || '',
        });
        return jsonResponse(request, env, 429, {
          ok: false,
          code: 'LEAD_RATE_LIMITED',
          reason: duplicatePolicy.reason,
          retryAfter: 60,
        }, METHODS);
      }
      const saved = await upsertD1Lead(db, {
        ...lead,
        createdAt: lead.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        projectId: project.projectId,
        pageId: body.page?.id || lead.pageId || '',
        pageSlug: body.page?.slug || project.slug || lead.pageSlug || '',
      });
      return jsonResponse(request, env, 200, { ok: true, lead: saved }, METHODS);
    }

    if (request.method === 'GET') {
      const project = projectFromRequest(url, {}, request);
      await authorizeProject(request, env, project, { tab: 'inbox' });
      const result = await listD1Leads(db, {
        projectId: project.projectId,
        month: monthFromRequest(url),
        status: url.searchParams.get('status') || '',
        kind: url.searchParams.get('kind') || '',
        deliveryStatus: url.searchParams.get('deliveryStatus') || '',
        q: url.searchParams.get('q') || '',
        cursor: Number(url.searchParams.get('cursor') || 0),
        limit: Number(url.searchParams.get('limit') || 50),
      });
      return jsonResponse(request, env, 200, {
        ok: true,
        leads: result.records,
        total: result.total,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
        meta: { source: 'd1', month: monthFromRequest(url), ...result.meta },
      }, METHODS);
    }

    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

function normalizeDuplicateSettings(page = {}) {
  const source = page.leadDuplicateSettings || page.duplicateCollectionSettings || {};
  return {
    rejectIpDuplicate: !!source.rejectIpDuplicate,
    rejectCookieDuplicate: source.rejectCookieDuplicate !== false,
    formDuplicateLimitCount: Math.max(1, Math.min(5, Number(source.formDuplicateLimitCount || 3))),
    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(String(source.formDuplicateLimitWindow || ''))
      ? String(source.formDuplicateLimitWindow)
      : '1d',
    phoneEmailMode: ['mark', 'warn', 'block'].includes(String(source.phoneEmailMode || ''))
      ? String(source.phoneEmailMode)
      : 'mark',
  };
}

function duplicateWindowMs(value = '1d') {
  return ({
    '1d': 86400000,
    '3d': 259200000,
    '7d': 604800000,
    '30d': 2592000000,
  })[value] || 86400000;
}

function normalizedPhone(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function normalizedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function leadField(lead = {}, key) {
  return lead[key] || lead.values?.[key] || '';
}

function sameRecentLead(item = {}, lead = {}, nowMs, windowMs) {
  const createdMs = Date.parse(item.createdAt || item.submittedAt || '');
  if (!Number.isFinite(createdMs) || nowMs - createdMs > windowMs) return false;
  const phone = normalizedPhone(leadField(lead, 'phone'));
  const email = normalizedEmail(leadField(lead, 'email'));
  const clientId = String(lead.clientId || lead.values?.clientId || '').trim();
  const ipHash = String(lead.ipHash || lead.values?.ipHash || '').trim();
  const itemPhone = normalizedPhone(item.phoneNormalized || item.phone || item.values?.phone || '');
  const itemEmail = normalizedEmail(item.emailNormalized || item.email || item.values?.email || '');
  return (
    (!!phone && phone === itemPhone) ||
    (!!email && email === itemEmail) ||
    (!!clientId && clientId === String(item.clientId || item.values?.clientId || '')) ||
    (!!ipHash && ipHash === String(item.ipHash || item.values?.ipHash || ''))
  );
}

async function evaluateD1LeadDuplicatePolicy(db, project = {}, page = {}, lead = {}) {
  const settings = normalizeDuplicateSettings(page);
  const month = monthFromLead(lead);
  const phone = normalizedPhone(leadField(lead, 'phone'));
  const email = normalizedEmail(leadField(lead, 'email'));
  const clientId = String(lead.clientId || lead.values?.clientId || '').trim();
  const ipHash = String(lead.ipHash || lead.values?.ipHash || '').trim();
  if (!phone && !email && !clientId && !ipHash) return { blocked: false };

  const recent = await findD1LeadsByIntakeSignals(db, {
    projectId: project.projectId,
    month,
    pageSlug: page.slug || project.slug || lead.pageSlug || '',
    phone,
    email,
    clientId,
    ipHash,
    limit: 200,
  });
  const nowMs = Date.now();
  const windowMs = duplicateWindowMs(settings.formDuplicateLimitWindow);
  const inWindow = recent.filter((item) => sameRecentLead(item, lead, nowMs, windowMs));
  const phoneHit = !!phone && inWindow.some((item) => normalizedPhone(item.phoneNormalized || item.phone || item.values?.phone || '') === phone);
  const emailHit = !!email && inWindow.some((item) => normalizedEmail(item.emailNormalized || item.email || item.values?.email || '') === email);
  const clientHits = clientId ? inWindow.filter((item) => String(item.clientId || item.values?.clientId || '') === clientId).length : 0;
  const ipHits = ipHash ? inWindow.filter((item) => String(item.ipHash || '') === ipHash).length : 0;

  if (settings.phoneEmailMode === 'block' && phoneHit) return { blocked: true, reason: 'phone_duplicate', policySnapshot: settings };
  if (settings.phoneEmailMode === 'block' && emailHit) return { blocked: true, reason: 'email_duplicate', policySnapshot: settings };
  if (settings.rejectCookieDuplicate && clientHits >= settings.formDuplicateLimitCount) return { blocked: true, reason: 'client_duplicate_limit', policySnapshot: settings };
  if (settings.rejectIpDuplicate && ipHits >= settings.formDuplicateLimitCount) return { blocked: true, reason: 'ip_duplicate_limit', policySnapshot: settings };
  return { blocked: false };
}

function monthFromLead(lead = {}) {
  return String(lead.createdMonth || lead.createdAt || new Date().toISOString()).slice(0, 7);
}

function maskContact(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    return `${name.slice(0, 2)}***@${domain || ''}`;
  }
  return text.length > 4 ? `${text.slice(0, 3)}****${text.slice(-4)}` : '****';
}

function blockedLeadRecord(policy = {}, lead = {}, project = {}, page = {}) {
  const phone = normalizedPhone(leadField(lead, 'phone'));
  const email = normalizedEmail(leadField(lead, 'email'));
  return {
    id: `blocked_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    projectId: project.projectId,
    pageSlug: page.slug || project.slug || lead.pageSlug || '',
    reason: policy.reason || 'rate_limited',
    riskScore: 100,
    policySnapshot: policy.policySnapshot || {},
    ipHash: String(lead.ipHash || lead.values?.ipHash || ''),
    clientId: String(lead.clientId || lead.values?.clientId || ''),
    userAgentHash: String(lead.userAgentHash || ''),
    contactSummary: [phone ? maskContact(phone) : '', email ? maskContact(email) : ''].filter(Boolean).join(' / '),
    fieldSummary: {
      name: String(leadField(lead, 'name')).slice(0, 80),
      type: String(lead.type || lead.kind || '').slice(0, 40),
      phoneTail: phone ? phone.slice(-4) : '',
      emailDomain: email.includes('@') ? email.split('@').pop() : '',
    },
    createdMonth: monthFromLead(lead),
    createdAt: new Date().toISOString(),
  };
}

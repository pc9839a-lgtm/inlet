import { findD1LeadsByIntakeSignals, getD1LatestPageByProject, getD1PageBySlug, getD1ProjectById, getD1PublicPageBySlug, insertD1BlockedLeadSubmission, listD1Leads, upsertD1Lead } from '../../server/storage/d1Adapter.mjs';
import { deliveryReport, normalizeDeliveryPage, sendLeadDelivery } from './leads/_delivery.js';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, monthFromRequest, optionsResponse, projectFromRequest, publicProjectShell, readJson } from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';
const PUBLIC_POST_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': METHODS,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Inlet-Api-Token, X-Inlet-Owner-Id, X-Inlet-Project-Id, X-Inlet-Session',
  'Access-Control-Max-Age': '86400',
};

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    const requestedMethod = String(request.headers.get('Access-Control-Request-Method') || '').toUpperCase();
    if (requestedMethod === 'POST') return new Response(null, { status: 204, headers: PUBLIC_POST_HEADERS });
    return optionsResponse(request, env, METHODS);
  }

  try {
    const url = new URL(request.url);
    const db = assertD1(env);

    if (request.method === 'POST') {
      const body = await readJson(request);
      const initialProject = projectFromRequest(url, body, request);
      const publicContext = await publicLeadPageContext(db, body, initialProject);
      const project = publicContext.project;
      body.page = publicContext.page;
      body.project = project;
      await authorizeProject(request, env, project, { publicWrite: true });
      await ensureD1ProjectShell(db, publicProjectShell(project));
      const lead = normalizePublicLeadPayload(
        withRequestIntakeSignals(body.lead && typeof body.lead === 'object' ? body.lead : body, request),
        body,
      );
      const duplicatePolicy = await evaluateD1LeadDuplicatePolicy(db, project, body.page || {}, lead);
      if (duplicatePolicy.blocked) {
        await insertD1BlockedLeadSubmission(db, blockedLeadRecord(duplicatePolicy, lead, project, body.page || {}), {
          projectId: project.projectId,
          pageSlug: body.page?.slug || project.slug || lead.pageSlug || '',
        });
        return publicPostJsonResponse(request, env, 429, {
          ok: false,
          code: 'LEAD_RATE_LIMITED',
          reason: duplicatePolicy.reason,
          message: '중복 접수 정책에 따라 이번 접수는 차단되었습니다.',
          retryAfter: 60,
        });
      }
      let saved = await upsertD1Lead(db, {
        ...lead,
        createdAt: lead.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, {
        projectId: project.projectId,
        pageId: body.page?.id || lead.pageId || '',
        pageSlug: body.page?.slug || project.slug || lead.pageSlug || '',
      });
      const delivery = await sendSavedLeadDelivery(db, saved, body.page || {}, project, env);
      saved = await upsertD1Lead(db, {
        ...saved,
        delivery,
        deliveryStatus: delivery.status,
        updatedAt: new Date().toISOString(),
      }, {
        projectId: project.projectId,
        pageId: saved.pageId || body.page?.id || lead.pageId || '',
        pageSlug: saved.pageSlug || body.page?.slug || project.slug || lead.pageSlug || '',
      });
      return publicPostJsonResponse(request, env, 200, { ok: true, lead: saved, delivery: saved.delivery || delivery });
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

    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  } catch (error) {
    if (request.method === 'POST') return handlePublicPostError(request, env, error);
    return handleApiError(request, env, error, METHODS);
  }
}

function publicPostJsonResponse(request, env, status, payload) {
  return jsonResponse(request, env, status, payload, METHODS, { headers: PUBLIC_POST_HEADERS });
}

function trafficAttributionFromSourceUrl(value = '') {
  const text = String(value || '').trim();
  if (!text) return { utmSource: '', utmMedium: '', utmCampaign: '', channel: '' };
  try {
    const parsed = new URL(text, 'https://pagero.local');
    const normalize = (input = '') => String(input || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 80);
    const utmSource = normalize(parsed.searchParams.get('utm_source'));
    const utmMedium = normalize(parsed.searchParams.get('utm_medium'));
    const utmCampaign = normalize(parsed.searchParams.get('utm_campaign'));
    return { utmSource, utmMedium, utmCampaign, channel: utmSource || '' };
  } catch {
    return { utmSource: '', utmMedium: '', utmCampaign: '', channel: '' };
  }
}

function normalizePublicLeadPayload(lead = {}, body = {}) {
  const source = lead.source && typeof lead.source === 'object' ? lead.source : {};
  const page = body.page && typeof body.page === 'object' ? body.page : {};
  const values = lead.values && typeof lead.values === 'object' ? lead.values : {};
  const sourceUrl = lead.sourceUrl || source.sourceUrl || source.url || source.pageUrl || values.sourceUrl || '';
  const sourceAttribution = trafficAttributionFromSourceUrl(sourceUrl);
  const utmSource = lead.utmSource || lead.utm_source || source.utmSource || source.utm_source || values.utmSource || values.utm_source || sourceAttribution.utmSource || '';
  const utmMedium = lead.utmMedium || lead.utm_medium || source.utmMedium || source.utm_medium || values.utmMedium || values.utm_medium || sourceAttribution.utmMedium || '';
  const utmCampaign = lead.utmCampaign || lead.utm_campaign || source.utmCampaign || source.utm_campaign || values.utmCampaign || values.utm_campaign || sourceAttribution.utmCampaign || '';
  const channel = lead.channel || source.channel || values.channel || sourceAttribution.channel || '';
  const sourceLabel = lead.sourceLabel || source.sourceLabel || values.sourceLabel || channel || '';
  return {
    ...lead,
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
    values: {
      ...values,
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(source.referrer || values.referrer ? { referrer: source.referrer || values.referrer } : {}),
      ...(channel ? { channel } : {}),
      ...(sourceLabel ? { sourceLabel } : {}),
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
    },
  };
}

async function handlePublicPostError(request, env, error) {
  const response = await handleApiError(request, env, error, METHODS);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(PUBLIC_POST_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function publicLeadPageContext(db, body = {}, project = {}) {
  const inputPage = body.page && typeof body.page === 'object' ? body.page : {};
  const inputSlug = String(inputPage.slug || body.lead?.pageSlug || project.slug || '').replace(/[^a-zA-Z0-9-_]/g, '');
  if (!inputSlug) {
    return {
      project,
      page: inputPage,
    };
  }

  const publicPage = await getD1PublicPageBySlug(db, { slug: inputSlug });
  if (!publicPage?.projectId) {
    return {
      project: { ...project, slug: project.slug || inputSlug },
      page: { ...inputPage, slug: inputSlug },
    };
  }

  return {
    project: {
      ...project,
      projectId: publicPage.projectId,
      id: publicPage.projectId,
      slug: publicPage.slug || inputSlug,
      title: publicPage.title || project.title || '',
    },
    page: {
      ...inputPage,
      projectId: publicPage.projectId,
      id: publicPage.id || inputPage.id || '',
      slug: publicPage.slug || inputSlug,
      title: inputPage.title || publicPage.title || '',
      integrations: publicPage.integrations || inputPage.integrations || {},
      leadDuplicateSettings: publicPage.leadDuplicateSettings || inputPage.leadDuplicateSettings || {},
      duplicateCollectionSettings: publicPage.duplicateCollectionSettings || inputPage.duplicateCollectionSettings || {},
    },
  };
}

async function sendSavedLeadDelivery(db, lead = {}, inputPage = {}, project = {}, env = {}) {
  try {
    let storedPage = await getD1PageBySlug(db, {
      projectId: project.projectId,
      slug: inputPage.slug || lead.pageSlug || project.slug || '',
    });
    if (!storedPage && project.projectId) {
      storedPage = await getD1LatestPageByProject(db, { projectId: project.projectId });
    }
    const deliveryPage = await ensureDeliveryEmailRecipient(db, normalizeDeliveryPage(inputPage, storedPage || {}, project), project);
    return await sendLeadDelivery(lead, deliveryPage, env);
  } catch (error) {
    return deliveryReport('failed', '접수는 저장됐지만 알림 전송에 실패했습니다.', [{
      target: '알림 전송',
      provider: 'server',
      status: 'failed',
      message: String(error?.message || error || '전송 실패'),
      at: new Date().toISOString(),
    }]);
  }
}

async function ensureDeliveryEmailRecipient(db, page = {}, project = {}) {
  const integrations = page.integrations && typeof page.integrations === 'object' ? page.integrations : {};
  const email = integrations.email && typeof integrations.email === 'object' ? integrations.email : {};
  if (!email.enabled || isValidEmail(email.to)) return page;

  const fallback = await deliveryEmailFallback(db, project);
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

async function deliveryEmailFallback(db, project = {}) {
  const projectId = String(project.projectId || project.id || '').trim();
  const projectRow = projectId ? await getD1ProjectById(db, projectId) : null;
  const ownerId = String(project.ownerId || project.ownerAccountId || projectRow?.ownerId || projectRow?.ownerAccountId || '').trim();
  const ownerEmail = ownerId
    ? await db.prepare('SELECT email FROM accounts WHERE id = ? LIMIT 1').bind(ownerId).first().then((row) => usableDeliveryEmail(row?.email || '')).catch(() => '')
    : '';
  return ownerEmail || usableDeliveryEmail(project.clientEmail || projectRow?.clientEmail || '');
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function usableDeliveryEmail(value = '') {
  const email = normalizeEmail(value);
  if (!isValidEmail(email)) return '';
  if (email.endsWith('@public.inlet.local')) return '';
  return email;
}

function isValidEmail(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizeDuplicateSettings(page = {}) {
  const source = page.leadDuplicateSettings || page.duplicateCollectionSettings || {};
  const rawCount = Number(source.formDuplicateLimitCount ?? source.fieldDuplicateLimitCount ?? source.duplicateLimitCount ?? 3);
  const windowKey = String(source.formDuplicateLimitWindow || source.fieldDuplicateLimitPeriod || source.duplicateWindow || source.duplicateWindowKey || '1d');
  const phoneEmailMode = String(source.phoneEmailMode || source.phoneEmailDuplicateMode || source.contactDuplicateMode || 'mark').trim();
  return {
    rejectIpDuplicate: !!(source.rejectIpDuplicate ?? source.ipDuplicateRejectEnabled ?? false),
    rejectCookieDuplicate: (source.rejectCookieDuplicate ?? source.cookieDuplicateRejectEnabled ?? true) !== false,
    formDuplicateLimitCount: Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 3)),
    formDuplicateLimitWindow: ['1d', '3d', '7d', '30d'].includes(windowKey)
      ? windowKey
      : '1d',
    phoneEmailMode: ['block', 'reject', 'deny'].includes(phoneEmailMode) ? 'block' : 'mark',
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

function requestIp(request) {
  return String(
    request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')?.[0]
    || request.headers.get('X-Real-IP')
    || '',
  ).trim();
}

function stableHash(value = '') {
  let hash = 2166136261;
  const input = String(value || '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return input ? (hash >>> 0).toString(36).padStart(7, '0') : '';
}

function withRequestIntakeSignals(lead = {}, request) {
  const ipHash = String(lead.ipHash || lead.values?.ipHash || stableHash(requestIp(request))).trim();
  const clientId = String(lead.clientId || lead.values?.clientId || '').trim();
  const userAgentHash = String(lead.userAgentHash || lead.values?.userAgentHash || stableHash(request.headers.get('User-Agent') || '')).trim();
  return {
    ...lead,
    ...(ipHash ? { ipHash } : {}),
    ...(clientId ? { clientId } : {}),
    ...(userAgentHash ? { userAgentHash } : {}),
    values: {
      ...(lead.values || {}),
      ...(ipHash ? { ipHash } : {}),
      ...(clientId ? { clientId } : {}),
      ...(userAgentHash ? { userAgentHash } : {}),
    },
  };
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

function previousPolicyMonth(month = '') {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function uniqueLeads(leads = []) {
  const seen = new Set();
  return leads.filter((lead) => {
    const key = String(lead.id || `${lead.createdAt}:${lead.phone}:${lead.email}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function evaluateD1LeadDuplicatePolicy(db, project = {}, page = {}, lead = {}) {
  const settings = normalizeDuplicateSettings(page);
  const month = monthFromLead(lead);
  const phone = normalizedPhone(leadField(lead, 'phone'));
  const email = normalizedEmail(leadField(lead, 'email'));
  const clientId = String(lead.clientId || lead.values?.clientId || '').trim();
  const ipHash = String(lead.ipHash || lead.values?.ipHash || '').trim();
  if (!phone && !email && !clientId && !ipHash) return { blocked: false };

  const months = [month, previousPolicyMonth(month)].filter(Boolean);
  const recent = uniqueLeads((await Promise.all(months.map((itemMonth) => findD1LeadsByIntakeSignals(db, {
    projectId: project.projectId,
    month: itemMonth,
    pageSlug: page.slug || project.slug || lead.pageSlug || '',
    phone,
    email,
    clientId,
    ipHash,
    limit: 300,
  })))).flat()).filter((item) => String(item.id || '') !== String(lead.id || ''));
  const nowMs = Date.now();
  const windowMs = duplicateWindowMs(settings.formDuplicateLimitWindow);
  const inWindow = recent.filter((item) => sameRecentLead(item, lead, nowMs, windowMs));
  const phoneHit = !!phone && inWindow.some((item) => normalizedPhone(item.phoneNormalized || item.phone || item.values?.phone || '') === phone);
  const emailHit = !!email && inWindow.some((item) => normalizedEmail(item.emailNormalized || item.email || item.values?.email || '') === email);
  const clientHits = clientId ? inWindow.filter((item) => String(item.clientId || item.values?.clientId || '') === clientId).length : 0;
  const ipHits = ipHash ? inWindow.filter((item) => String(item.ipHash || '') === ipHash).length : 0;
  const ipMinuteHits = ipHash ? recent.filter((item) => {
    const createdMs = Date.parse(item.createdAt || item.submittedAt || '');
    if (!Number.isFinite(createdMs)) return false;
    return String(item.ipHash || '') === ipHash && nowMs - createdMs >= 0 && nowMs - createdMs <= 60000;
  }).length : 0;
  const metrics = {
    window: settings.formDuplicateLimitWindow,
    limit: settings.formDuplicateLimitCount,
    phoneHits: phoneHit ? 1 : 0,
    emailHits: emailHit ? 1 : 0,
    clientHits,
    ipHits,
    ipMinuteHits,
  };

  if (settings.phoneEmailMode === 'block' && phoneHit) return { blocked: true, reason: 'phone_duplicate', retryAfter: Math.ceil(windowMs / 1000), metrics, policySnapshot: { ...settings, metrics } };
  if (settings.phoneEmailMode === 'block' && emailHit) return { blocked: true, reason: 'email_duplicate', retryAfter: Math.ceil(windowMs / 1000), metrics, policySnapshot: { ...settings, metrics } };
  if (settings.rejectCookieDuplicate && clientId && clientHits >= settings.formDuplicateLimitCount) return { blocked: true, reason: 'client_duplicate_limit', retryAfter: Math.ceil(windowMs / 1000), metrics, policySnapshot: { ...settings, metrics } };
  if (settings.rejectIpDuplicate && ipHash && ipHits >= settings.formDuplicateLimitCount) return { blocked: true, reason: 'ip_duplicate_limit', retryAfter: Math.ceil(windowMs / 1000), metrics, policySnapshot: { ...settings, metrics } };
  if (ipHash && ipMinuteHits >= 3) return { blocked: true, reason: 'ip_rate_limit_1m', retryAfter: 60, metrics, policySnapshot: { ...settings, metrics } };
  return { blocked: false, metrics, policySnapshot: { ...settings, metrics } };
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
      blockedBy: String(policy.reason || 'rate_limited'),
      hits: policy.metrics || policy.policySnapshot?.metrics || {},
    },
    createdMonth: monthFromLead(lead),
    createdAt: lead.createdAt || new Date().toISOString(),
  };
}

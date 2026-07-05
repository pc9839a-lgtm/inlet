import { normalizeIntegrations } from '../../lib/pageModel.js';
import { leadPrimaryContact } from '../../lib/leadModel.js';
import { shouldLockEmailRecipient } from '../../lib/planPolicy.js';

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function firstText(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

export function leadTime(lead = {}) {
  const time = new Date(lead.createdAt || lead.savedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function leadInDateRange(lead = {}, range = {}) {
  const time = leadTime(lead);
  if (!time) return false;
  if (range.dateFrom && time < new Date(`${range.dateFrom}T00:00:00`).getTime()) return false;
  if (range.dateTo && time > new Date(`${range.dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

export function fmtDateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '').slice(0, 10) : date.toLocaleDateString('ko-KR');
}

export function leadSourceUrl(lead = {}) {
  return firstText(
    lead.sourceUrl,
    lead.source?.sourceUrl,
    lead.source?.url,
    lead.source?.pageUrl,
    lead.attribution?.sourceUrl,
    lead.values?.sourceUrl,
    lead.pageUrl,
  );
}

export function leadReferrer(lead = {}) {
  return firstText(
    lead.referrer,
    lead.source?.referrer,
    lead.attribution?.referrer,
    lead.values?.referrer,
  );
}

export function leadUtmText(lead = {}) {
  const source = firstText(lead.utmSource, lead.utm_source, lead.source?.utmSource, lead.source?.utm_source, lead.attribution?.utmSource, lead.values?.utmSource, lead.values?.utm_source);
  const medium = firstText(lead.utmMedium, lead.utm_medium, lead.source?.utmMedium, lead.source?.utm_medium, lead.attribution?.utmMedium, lead.values?.utmMedium, lead.values?.utm_medium);
  const campaign = firstText(lead.utmCampaign, lead.utm_campaign, lead.source?.utmCampaign, lead.source?.utm_campaign, lead.attribution?.utmCampaign, lead.values?.utmCampaign, lead.values?.utm_campaign);
  return [
    source ? `source=${source}` : '',
    medium ? `medium=${medium}` : '',
    campaign ? `campaign=${campaign}` : '',
  ].filter(Boolean).join(' / ');
}

export function isDuplicateLeadAnswer(item = {}, lead = {}) {
  const label = normalizedText(item.label || item.name);
  const value = normalizedText(item.value);
  const duplicateLabels = [
    'name',
    '이름',
    '성함',
    '연락처',
    '전화',
    '전화번호',
    '핸드폰',
    '휴대폰',
    'phone',
    'email',
    '이메일',
    '메일',
    '문의내용',
    '상담내용',
    '메시지',
    'message',
  ];
  if (duplicateLabels.some((key) => label.includes(normalizedText(key)))) return true;
  const duplicateValues = [lead.name, leadPrimaryContact(lead), lead.email, lead.message].map(normalizedText).filter(Boolean);
  return value && duplicateValues.includes(value);
}

export function isFreeEmailLocked(page = {}, authUser = null) {
  return shouldLockEmailRecipient(page, authUser);
}

export function lockedAccountEmail(authUser = null, page = {}, integrations = null) {
  const sourceIntegrations = integrations || normalizeIntegrations(page.integrations || {});
  return String(
    authUser?.email
    || page?.ownership?.ownerEmail
    || page?.ownerEmail
    || page?.clientEmail
    || sourceIntegrations?.email?.to
    || ''
  ).trim().toLowerCase();
}

export function enforceFreeEmailIntegration(integrations = {}, page = {}, authUser = null) {
  const normalized = normalizeIntegrations(integrations || {});
  if (!isFreeEmailLocked(page, authUser)) return normalized;
  const accountEmail = lockedAccountEmail(authUser, page, normalized);
  return normalizeIntegrations({
    ...normalized,
    email: {
      ...(normalized.email || {}),
      to: accountEmail || '',
      lockedToAccount: true,
    },
  });
}

export function collectGoogleSheetHeaders(page = {}) {
  const headers = [];
  const add = (value) => {
    const label = String(value || '').trim();
    if (!label || headers.includes(label)) return;
    headers.push(label);
  };

  for (const block of Array.isArray(page.blocks) ? page.blocks : []) {
    if (block?.visible === false) continue;
    const settings = block.s || block.settings || {};
    if (block.type === 'form') {
      const questions = Array.isArray(settings.questions) ? settings.questions : [];
      if (!questions.length) {
        add('이름');
        add('연락처');
        add('문의내용');
      }
      for (const question of questions) {
        if (question?.enabled === false) continue;
        add(question?.label);
      }
    }
    if (block.type === 'reservation') {
      add('예약일');
      add('예약시간');
      if (settings.fields?.name !== false) add('이름');
      if (settings.fields?.phone !== false) add('연락처');
      for (const field of Array.isArray(settings.customFields) ? settings.customFields : []) {
        if (field?.enabled === false) continue;
        add(field?.label);
      }
    }
  }

  return headers.slice(0, 40);
}

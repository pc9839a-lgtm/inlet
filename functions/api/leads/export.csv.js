import { listD1Leads } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, optionsResponse, projectFromRequest } from '../_shared.js';

const METHODS = 'GET, OPTIONS';
const CSV_HEADERS = [
  '\uC811\uC218 ID',
  '\uC811\uC218\uC77C',
  '\uC811\uC218 \uC720\uD615',
  '\uC0C1\uD0DC',
  '\uC774\uB984',
  '\uC5F0\uB77D\uCC98',
  '\uC774\uBA54\uC77C',
  '\uD398\uC774\uC9C0 \uC8FC\uC18C',
  '\uC720\uC785 URL',
  'UTM Source',
  'UTM Medium',
  'UTM Campaign',
  '\uBA54\uBAA8',
  '\uB2F5\uBCC0 \uC804\uCCB4',
  '\uC785\uB825\uAC12 \uC804\uCCB4',
];

const BASE_DYNAMIC_VALUE_KEYS = new Set([
  'name',
  'phone',
  'email',
  'address',
  'message',
  'memo',
  'clientId',
  'phoneNormalized',
  'emailNormalized',
]);

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);

  try {
    if (request.method !== 'GET') {
      return csvError(request, env, 405, 'Method not allowed.');
    }

    const url = new URL(request.url);
    const month = String(url.searchParams.get('month') || '').trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return csvError(request, env, 400, 'month is required for CSV export.');
    }

    const db = assertD1(env);
    const project = projectFromRequest(url, {}, request);
    await authorizeProject(request, env, project, { tab: 'inbox' });

    const leads = [];
    let cursor = 0;
    for (let guard = 0; guard < 50; guard += 1) {
      const page = await listD1Leads(db, {
        projectId: project.projectId,
        month,
        status: url.searchParams.get('status') || '',
        kind: url.searchParams.get('kind') || '',
        deliveryStatus: url.searchParams.get('deliveryStatus') || '',
        q: url.searchParams.get('q') || '',
        cursor,
        limit: 100,
      });
      leads.push(...page.records);
      if (!page.hasMore || page.nextCursor == null) break;
      cursor = page.nextCursor;
    }

    const csv = toCsv(leads);
    const filename = `${safeFileName(project.slug || project.projectId || 'pagero')}-leads-${month}.csv`;
    return new Response(`\ufeff${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        ...corsHeadersForCsv(request, env),
      },
    });
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

function toCsv(leads = []) {
  const dynamicHeaders = collectDynamicFieldHeaders(leads);
  const rows = [[...CSV_HEADERS, ...dynamicHeaders]];
  for (const lead of leads) {
    const dynamicFields = dynamicFieldMap(lead);
    rows.push([
      lead.id || '',
      dateOnly(lead.createdAt || ''),
      lead.kind || lead.type || '',
      lead.status || '',
      lead.name || lead.values?.name || '',
      lead.phone || lead.values?.phone || '',
      lead.email || lead.values?.email || '',
      lead.pageSlug || '',
      lead.sourceUrl || lead.values?.sourceUrl || '',
      lead.utmSource || lead.source?.utmSource || '',
      lead.utmMedium || lead.source?.utmMedium || '',
      lead.utmCampaign || lead.source?.utmCampaign || '',
      lead.memo || lead.message || lead.values?.memo || '',
      answersText(lead.answers),
      valuesText(lead.values),
      ...dynamicHeaders.map((header) => dynamicFields[header] || ''),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function cleanFieldLabel(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function dynamicFieldHeader(label = '') {
  return `\uC785\uB825: ${cleanFieldLabel(label)}`;
}

function flatValue(value) {
  if (Array.isArray(value)) return value.map(flatValue).join(', ');
  if (value && typeof value === 'object') return Object.values(value).map(flatValue).filter(Boolean).join(' ');
  return String(value ?? '');
}

function collectDynamicFieldHeaders(leads = []) {
  const seen = new Set();
  const headers = [];
  for (const lead of leads || []) {
    for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
      const label = cleanFieldLabel(answer.label || answer.id || '');
      if (!label) continue;
      const header = dynamicFieldHeader(label);
      if (!seen.has(header)) {
        seen.add(header);
        headers.push(header);
      }
    }
    for (const key of Object.keys(lead.values || {})) {
      const label = cleanFieldLabel(key);
      if (!label || BASE_DYNAMIC_VALUE_KEYS.has(label)) continue;
      const header = dynamicFieldHeader(label);
      if (!seen.has(header)) {
        seen.add(header);
        headers.push(header);
      }
    }
  }
  return headers;
}

function dynamicFieldMap(lead = {}) {
  const fields = {};
  for (const [key, value] of Object.entries(lead.values || {})) {
    const label = cleanFieldLabel(key);
    if (!label || BASE_DYNAMIC_VALUE_KEYS.has(label)) continue;
    fields[dynamicFieldHeader(label)] = flatValue(value);
  }
  for (const answer of Array.isArray(lead.answers) ? lead.answers : []) {
    const label = cleanFieldLabel(answer.label || answer.id || '');
    if (!label) continue;
    fields[dynamicFieldHeader(label)] = flatValue(answer.value);
  }
  return fields;
}

function answersText(answers = []) {
  return (Array.isArray(answers) ? answers : [])
    .map((answer) => `${answer.label || answer.id || '\uB2F5\uBCC0'}: ${flatValue(answer.value)}`)
    .filter(Boolean)
    .join(' / ');
}

function valuesText(values = {}) {
  return Object.entries(values || {})
    .map(([key, value]) => `${key}: ${flatValue(value)}`)
    .filter(Boolean)
    .join(' / ');
}

function csvCell(value = '') {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function dateOnly(value = '') {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(value || '');
}

function safeFileName(value = '') {
  return String(value || 'pagero').replace(/[^a-zA-Z0-9\uAC00-\uD7A3-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'pagero';
}

function corsHeadersForCsv(request, env = {}) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.INLET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || 'https://pagero.kr';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': METHODS,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Inlet-Api-Token, X-Inlet-Owner-Id, X-Inlet-Project-Id, X-Inlet-Session',
    Vary: 'Origin',
  };
}

function csvError(request, env, status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeadersForCsv(request, env),
    },
  });
}

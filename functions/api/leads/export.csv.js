import { listD1Leads } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, optionsResponse, projectFromRequest } from '../_shared.js';

const METHODS = 'GET, OPTIONS';
const CSV_HEADERS = [
  'id',
  'createdAt',
  'kind',
  'status',
  'name',
  'phone',
  'email',
  'deliveryStatus',
  'pageSlug',
  'memo',
];

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
    const filename = `${safeFileName(project.slug || project.projectId || 'inlet')}-leads-${month}.csv`;
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
  const rows = [CSV_HEADERS];
  for (const lead of leads) {
    rows.push([
      lead.id || '',
      dateOnly(lead.createdAt || ''),
      lead.kind || lead.type || '',
      lead.status || '',
      lead.name || lead.values?.name || '',
      lead.phone || lead.values?.phone || '',
      lead.email || lead.values?.email || '',
      lead.deliveryStatus || lead.delivery?.status || '',
      lead.pageSlug || '',
      lead.memo || lead.message || lead.values?.memo || '',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
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
  return String(value || 'inlet').replace(/[^a-zA-Z0-9가-힣_-]/g, '-').replace(/-+/g, '-').slice(0, 80) || 'inlet';
}

function corsHeadersForCsv(request, env = {}) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.INLET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || 'https://inlet-8mr.pages.dev';
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

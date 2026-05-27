const baseUrl = String(process.env.INLET_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
const requireHosted = process.env.INLET_HOSTED_ROUTE_QA_REQUIRE === '1';
const allowWrites = process.env.INLET_HOSTED_ROUTE_QA_WRITE === '1';

function summarize(checks = []) {
  return checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
}

function skipped(missing = []) {
  return {
    ok: true,
    liveSummary: { 'skipped-live': 1 },
    checks: [{
      name: 'Hosted API route parity',
      status: 'skipped-live',
      missing,
      manualCheck: 'Set INLET_PUBLIC_API_URL and INLET_HOSTED_ROUTE_QA_WRITE=1 to verify D1-backed /api/leads, /api/events, and read protection on hosted Pages Functions.',
    }],
  };
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { text };
  }
  return { res, data, text };
}

async function run() {
  if (!baseUrl) return skipped(['INLET_PUBLIC_API_URL']);
  if (!allowWrites) return skipped(['INLET_HOSTED_ROUTE_QA_WRITE']);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const project = {
    projectId: `hosted-route-qa-${stamp}`,
    ownerId: 'hosted-route-qa',
    slug: `hosted-route-qa-${stamp}`,
  };
  const month = new Date().toISOString().slice(0, 7);
  const checks = [];

  const lead = await jsonFetch('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      project,
      page: { slug: project.slug },
      lead: {
        id: `lead-${stamp}`,
        type: 'consult',
        kind: 'consult',
        status: 'new',
        name: 'Hosted Route QA',
        phone: '010-0000-0000',
        memo: 'hosted route write smoke',
        createdAt: new Date().toISOString(),
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/leads public write',
    status: lead.res.ok && lead.data?.lead?.id === `lead-${stamp}` ? 'ready' : 'failed-live',
    httpStatus: lead.res.status,
  });

  const event = await jsonFetch('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      project,
      page: { slug: project.slug },
      event: {
        id: `event-${stamp}`,
        type: 'page_view',
        eventType: 'page_view',
        visitorId: `visitor-${stamp}`,
        sessionId: `session-${stamp}`,
        dedupeKey: `pv-${stamp}`,
        createdAt: new Date().toISOString(),
      },
    }),
  });
  checks.push({
    name: 'Hosted /api/events public write',
    status: event.res.ok && event.data?.event?.id === `event-${stamp}` ? 'ready' : 'failed-live',
    httpStatus: event.res.status,
  });

  const protectedLeads = await jsonFetch(`/api/leads?projectId=${encodeURIComponent(project.projectId)}&month=${month}`);
  checks.push({
    name: 'Hosted /api/leads read protection',
    status: protectedLeads.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedLeads.res.status,
  });

  const protectedStats = await jsonFetch(`/api/stats/summary?projectId=${encodeURIComponent(project.projectId)}&month=${month}`);
  checks.push({
    name: 'Hosted /api/stats/summary read protection',
    status: protectedStats.res.status === 403 ? 'ready' : 'failed-live',
    httpStatus: protectedStats.res.status,
  });

  return {
    ok: checks.every((check) => check.status === 'ready') || !requireHosted,
    liveSummary: summarize(checks),
    projectId: project.projectId,
    checks,
  };
}

const result = await run();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;

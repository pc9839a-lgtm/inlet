const DEFAULT_MAX_BODY_BYTES = 128 * 1024;
const DEFAULT_BURST_WINDOW_SECONDS = 10 * 60;
const DEFAULT_BURST_LIMIT = 30;
const DEFAULT_DAILY_LIMIT = 200;

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function publicLeadAbuseConfig(env = {}) {
  return {
    maxBodyBytes: boundedInteger(env.INLET_PUBLIC_LEAD_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES, 16 * 1024, 1024 * 1024),
    burstWindowSeconds: boundedInteger(env.INLET_PUBLIC_LEAD_IP_BURST_WINDOW_SECONDS, DEFAULT_BURST_WINDOW_SECONDS, 60, 60 * 60),
    burstLimit: boundedInteger(env.INLET_PUBLIC_LEAD_IP_BURST_LIMIT, DEFAULT_BURST_LIMIT, 5, 500),
    dailyLimit: boundedInteger(env.INLET_PUBLIC_LEAD_IP_DAILY_LIMIT, DEFAULT_DAILY_LIMIT, 20, 5000),
  };
}

function requestIp(request) {
  return String(
    request?.headers?.get?.('CF-Connecting-IP')
    || request?.headers?.get?.('X-Forwarded-For')?.split(',')?.[0]
    || request?.headers?.get?.('X-Real-IP')
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

export function publicLeadRequestIpHash(request) {
  return stableHash(requestIp(request));
}

function cancelBodyReader(reader) {
  try {
    const pending = reader?.cancel?.('payload-too-large');
    if (pending && typeof pending.catch === 'function') pending.catch(() => undefined);
  } catch {}
}

async function requestBodyWithinLimit(request, maxBodyBytes) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    return { ok: false, bytes: declared, source: 'content-length' };
  }
  if (!request.body || typeof request.clone !== 'function') return { ok: true, bytes: Math.max(0, declared || 0), source: 'none' };

  const clone = request.clone();
  const reader = clone.body?.getReader?.();
  if (!reader) return { ok: true, bytes: Math.max(0, declared || 0), source: 'unreadable' };

  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += Number(value?.byteLength || value?.length || 0);
      if (bytes > maxBodyBytes) {
        // Request.clone() creates a tee stream. Awaiting cancel on one branch can
        // wait for the untouched original branch in some runtimes, stalling the API.
        // Cancellation is therefore best-effort after the size decision is final.
        cancelBodyReader(reader);
        return { ok: false, bytes, source: 'stream' };
      }
    }
    return { ok: true, bytes, source: 'stream' };
  } finally {
    try { reader.releaseLock?.(); } catch {}
  }
}

async function publicLeadIpTraffic(db, ipHash, nowMs, config) {
  if (!db?.prepare || !ipHash) return { burstCount: 0, dailyCount: 0 };
  const burstSince = new Date(nowMs - config.burstWindowSeconds * 1000).toISOString();
  const dailySince = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const row = await db.prepare(`
    SELECT
      (
        (SELECT COUNT(*) FROM leads WHERE ip_hash = ? AND created_at >= ?)
        +
        (SELECT COUNT(*) FROM lead_blocked_submissions WHERE ip_hash = ? AND created_at >= ?)
      ) AS burst_count,
      (
        (SELECT COUNT(*) FROM leads WHERE ip_hash = ? AND created_at >= ?)
        +
        (SELECT COUNT(*) FROM lead_blocked_submissions WHERE ip_hash = ? AND created_at >= ?)
      ) AS daily_count
  `).bind(
    ipHash, burstSince,
    ipHash, burstSince,
    ipHash, dailySince,
    ipHash, dailySince,
  ).first();
  return {
    burstCount: Math.max(0, Number(row?.burst_count || 0)),
    dailyCount: Math.max(0, Number(row?.daily_count || 0)),
  };
}

export async function evaluatePublicLeadAbuse(request, env = {}, { requestId = '', nowMs = Date.now() } = {}) {
  const config = publicLeadAbuseConfig(env);
  const body = await requestBodyWithinLimit(request, config.maxBodyBytes);
  if (!body.ok) {
    return {
      allowed: false,
      status: 413,
      code: 'LEAD_PAYLOAD_TOO_LARGE',
      reason: 'payload_too_large',
      maxBodyBytes: config.maxBodyBytes,
      retryAfter: 0,
    };
  }

  const ipHash = publicLeadRequestIpHash(request);
  if (!ipHash || !env?.DB?.prepare) return { allowed: true, ipHash, config };

  try {
    const traffic = await publicLeadIpTraffic(env.DB, ipHash, nowMs, config);
    if (traffic.burstCount >= config.burstLimit) {
      return {
        allowed: false,
        status: 429,
        code: 'LEAD_ABUSE_RATE_LIMITED',
        reason: 'ip_burst_limit',
        retryAfter: config.burstWindowSeconds,
        traffic,
        config,
      };
    }
    if (traffic.dailyCount >= config.dailyLimit) {
      return {
        allowed: false,
        status: 429,
        code: 'LEAD_ABUSE_RATE_LIMITED',
        reason: 'ip_daily_limit',
        retryAfter: 60 * 60,
        traffic,
        config,
      };
    }
    return { allowed: true, ipHash, traffic, config };
  } catch (error) {
    console.warn('public lead abuse guard lookup failed', {
      requestId: String(requestId || '').slice(0, 80),
      errorName: String(error?.name || 'Error').slice(0, 64),
      errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
    });
    return { allowed: true, ipHash, config, degraded: true };
  }
}

export function publicLeadAbuseResponse(result = {}) {
  const status = Number(result.status || 429);
  const retryAfter = Math.max(0, Number(result.retryAfter || 0));
  const payload = status === 413
    ? {
        ok: false,
        code: 'LEAD_PAYLOAD_TOO_LARGE',
        message: '접수 데이터가 너무 큽니다. 입력 내용을 줄인 뒤 다시 시도해주세요.',
        maxBodyBytes: Number(result.maxBodyBytes || DEFAULT_MAX_BODY_BYTES),
      }
    : {
        ok: false,
        code: 'LEAD_ABUSE_RATE_LIMITED',
        message: '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.',
        retryAfter,
      };
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Inlet-Api-Token, X-Inlet-Owner-Id, X-Inlet-Project-Id, X-Inlet-Session',
    'Access-Control-Max-Age': '86400',
  };
  if (retryAfter > 0) headers['Retry-After'] = String(Math.ceil(retryAfter));
  return new Response(JSON.stringify(payload), { status, headers });
}

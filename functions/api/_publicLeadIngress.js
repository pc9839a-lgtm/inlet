export const PUBLIC_LEAD_MAX_BODY_BYTES = 128 * 1024;
export const PUBLIC_LEAD_BURST_WINDOW_MS = 5_000;
export const PUBLIC_LEAD_BURST_LIMIT = 20;
export const PUBLIC_LEAD_COOLDOWN_MS = 30_000;

const MAX_BURST_BUCKETS = 2_048;
const burstBuckets = new Map();

function stableHash(value = '') {
  let hash = 2166136261;
  const input = String(value || '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return input ? (hash >>> 0).toString(36).padStart(7, '0') : '';
}

function requestIp(request) {
  return String(
    request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')?.[0]
    || request.headers.get('X-Real-IP')
    || '',
  ).trim();
}

function clientBucketKey(request) {
  const ip = requestIp(request);
  return ip ? `ip:${stableHash(ip)}` : '';
}

function ingressJson(status, code, message, retryAfter = 0) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Retry-After',
  });
  if (retryAfter > 0) headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfter))));
  return new Response(JSON.stringify({
    ok: false,
    code,
    error: message,
    message,
    ...(retryAfter > 0 ? { retryAfter: Math.max(1, Math.ceil(retryAfter)) } : {}),
  }), { status, headers });
}

function declaredBodyTooLarge(request) {
  const raw = String(request.headers.get('Content-Length') || '').trim();
  if (!/^\d+$/.test(raw)) return false;
  return Number(raw) > PUBLIC_LEAD_MAX_BODY_BYTES;
}

async function streamedBodyTooLarge(request) {
  if (!request.body || typeof request.clone !== 'function') return false;
  let clone;
  try {
    clone = request.clone();
  } catch {
    return false;
  }
  const reader = clone.body?.getReader?.();
  if (!reader) return false;

  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      bytes += Number(value?.byteLength || 0);
      if (bytes > PUBLIC_LEAD_MAX_BODY_BYTES) {
        await reader.cancel('public lead body limit exceeded').catch(() => undefined);
        return true;
      }
    }
  } catch {
    return false;
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      // Reader cleanup is best-effort.
    }
  }
}

function pruneBurstBuckets(now) {
  if (burstBuckets.size <= MAX_BURST_BUCKETS) return;
  for (const [key, bucket] of burstBuckets) {
    if (now - Number(bucket.lastSeenAt || 0) > PUBLIC_LEAD_COOLDOWN_MS * 2) burstBuckets.delete(key);
  }
  if (burstBuckets.size <= MAX_BURST_BUCKETS) return;
  const overflow = burstBuckets.size - MAX_BURST_BUCKETS;
  let removed = 0;
  for (const key of burstBuckets.keys()) {
    burstBuckets.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function checkBurstLimit(request, now) {
  const key = clientBucketKey(request);
  if (!key) return { blocked: false, retryAfter: 0 };

  pruneBurstBuckets(now);
  const existing = burstBuckets.get(key) || {
    windowStartedAt: now,
    count: 0,
    blockedUntil: 0,
    lastSeenAt: now,
  };

  existing.lastSeenAt = now;
  if (Number(existing.blockedUntil || 0) > now) {
    burstBuckets.set(key, existing);
    return {
      blocked: true,
      retryAfter: Math.ceil((existing.blockedUntil - now) / 1000),
    };
  }

  if (now - Number(existing.windowStartedAt || 0) >= PUBLIC_LEAD_BURST_WINDOW_MS) {
    existing.windowStartedAt = now;
    existing.count = 0;
    existing.blockedUntil = 0;
  }

  existing.count += 1;
  if (existing.count > PUBLIC_LEAD_BURST_LIMIT) {
    existing.blockedUntil = now + PUBLIC_LEAD_COOLDOWN_MS;
    burstBuckets.set(key, existing);
    return {
      blocked: true,
      retryAfter: Math.ceil(PUBLIC_LEAD_COOLDOWN_MS / 1000),
    };
  }

  burstBuckets.set(key, existing);
  return { blocked: false, retryAfter: 0 };
}

export async function guardPublicLeadIngress(request, now = Date.now()) {
  if (declaredBodyTooLarge(request)) {
    return ingressJson(413, 'LEAD_PAYLOAD_TOO_LARGE', '접수 데이터가 너무 큽니다. 입력 내용을 줄인 뒤 다시 시도해주세요.');
  }

  const burst = checkBurstLimit(request, Number(now) || Date.now());
  if (burst.blocked) {
    return ingressJson(429, 'LEAD_INGRESS_RATE_LIMITED', '요청이 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.', burst.retryAfter);
  }

  if (await streamedBodyTooLarge(request)) {
    return ingressJson(413, 'LEAD_PAYLOAD_TOO_LARGE', '접수 데이터가 너무 큽니다. 입력 내용을 줄인 뒤 다시 시도해주세요.');
  }

  return null;
}

export function resetPublicLeadIngressForTests() {
  burstBuckets.clear();
}

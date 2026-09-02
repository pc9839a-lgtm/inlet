export const API_REQUEST_ID_HEADER = 'X-Pagero-Request-ID';
export const API_TRACE_SLOW_MS = 2500;

function safeToken(value = '', maxLength = 96) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, '')
    .slice(0, maxLength);
}

function createFallbackRequestId() {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createApiRequestTrace(request, now = Date.now()) {
  const url = new URL(request.url);
  let requestId = '';
  try {
    requestId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : '';
  } catch {
    requestId = '';
  }

  return {
    requestId: safeToken(requestId || createFallbackRequestId()),
    method: String(request.method || 'GET').toUpperCase(),
    path: url.pathname || '/',
    edgeRay: safeToken(request.headers.get('cf-ray') || '', 64),
    startedAt: Number(now) || Date.now(),
  };
}

export function bindApiRequestTrace(context, trace) {
  try {
    if (!context.data || typeof context.data !== 'object') context.data = {};
    context.data.pageroRequestId = trace.requestId;
  } catch {
    // Trace propagation is best-effort and must never block the request.
  }
  return trace;
}

function appendExposeHeader(headers, name) {
  const current = String(headers.get('Access-Control-Expose-Headers') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!current.some((item) => item.toLowerCase() === name.toLowerCase())) current.push(name);
  if (current.length) headers.set('Access-Control-Expose-Headers', current.join(', '));
}

function attachTraceHeader(response, requestId) {
  if (!(response instanceof Response)) return response;

  try {
    response.headers.set(API_REQUEST_ID_HEADER, requestId);
    appendExposeHeader(response.headers, API_REQUEST_ID_HEADER);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set(API_REQUEST_ID_HEADER, requestId);
    appendExposeHeader(headers, API_REQUEST_ID_HEADER);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

function logFields(trace, status, durationMs) {
  return {
    requestId: trace.requestId,
    method: trace.method,
    path: trace.path,
    status,
    durationMs,
    ...(trace.edgeRay ? { edgeRay: trace.edgeRay } : {}),
  };
}

export function finalizeApiRequestTrace(response, trace, now = Date.now()) {
  const durationMs = Math.max(0, (Number(now) || Date.now()) - trace.startedAt);
  const status = Number(response?.status || 0);

  if (status >= 500) {
    console.error('Pagero API request failed', logFields(trace, status, durationMs));
  } else if (durationMs >= API_TRACE_SLOW_MS) {
    console.warn('Pagero API request slow', logFields(trace, status, durationMs));
  }

  return attachTraceHeader(response, trace.requestId);
}

export function logApiRequestException(trace, error, now = Date.now()) {
  const durationMs = Math.max(0, (Number(now) || Date.now()) - trace.startedAt);
  const errorName = safeToken(error?.name || 'Error', 64) || 'Error';
  const errorCode = safeToken(error?.code || '', 64);
  console.error('Pagero API request exception', {
    ...logFields(trace, 500, durationMs),
    errorName,
    ...(errorCode ? { errorCode } : {}),
  });
}

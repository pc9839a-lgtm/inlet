const METHODS = 'GET, OPTIONS';

export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Allow: METHODS, 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return new Response(JSON.stringify({ ok: false, error: '허용되지 않는 요청 방식입니다.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: METHODS, 'Cache-Control': 'no-store' },
  });
  const source = new URL(request.url);
  const target = new URL('calltag://external-lead/google-forms');
  for (const key of ['googleForms', 'googleFormsOAuth', 'reason']) {
    const value = clean(source.searchParams.get(key), key === 'googleFormsOAuth' ? 180 : 80);
    if (value) target.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clean(value, maxLength) {
  return String(value || '').replace(/[\r\n\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

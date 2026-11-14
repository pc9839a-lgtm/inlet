import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequest } from '../functions/life/[[path]].js';

const HTML = '<!doctype html><html><head><link rel="canonical" href="https://pagero.kr/life/support/example/"><meta name="robots" content="index,follow"></head><body>example</body></html>';

async function proxyFor(hostname, upstreamRobots = 'noindex, follow, noarchive') {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (request) => {
    requested.push(new URL(request.url).pathname);
    const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
    if (upstreamRobots !== null) headers.set('X-Robots-Tag', upstreamRobots);
    return new Response(HTML, { status: 200, headers });
  };
  try {
    const response = await onRequest({
      request: new Request(`https://${hostname}/life/support/example/`),
      next: () => { throw new Error('Canonical LIFE route must use its proxy'); },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(requested, ['/support/example/']);
    assert.equal(await response.text(), HTML);
    return response;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('canonical pagero.kr LIFE URL is indexable at the response-header layer', async () => {
  const response = await proxyFor('pagero.kr');
  assert.equal(response.headers.get('x-robots-tag'), null);
});

test('www and Pages preview hosts always keep a noindex response header', async () => {
  for (const hostname of ['www.pagero.kr', 'inlet-8mr.pages.dev']) {
    for (const upstreamHeader of ['noindex, follow, noarchive', null]) {
      const response = await proxyFor(hostname, upstreamHeader);
      assert.match(response.headers.get('x-robots-tag') || '', /noindex/i);
    }
  }
});

test('upstream errors are not converted into indexable content', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('upstream unavailable'); };
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await onRequest({
      request: new Request('https://pagero.kr/life/support/example/'),
      next: () => { throw new Error('unexpected next'); },
    });
    assert.equal(response.status, 502);
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/i);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

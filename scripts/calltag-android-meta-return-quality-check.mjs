import { readFile } from 'node:fs/promises';

const file = 'functions/api/calltag/v1/meta/oauth/android-return.js';
const source = await readFile(file, 'utf8');

function requireToken(token, message) {
  if (!source.includes(token)) throw new Error(`${message}: ${token}`);
}

function forbidToken(token, message) {
  if (source.includes(token)) throw new Error(`${message}: ${token}`);
}

requireToken("const target = new URL('calltag://external-lead/meta');", 'fixed Android callback target missing');
requireToken("source.searchParams.get('meta')", 'Meta status allowlist missing');
requireToken("source.searchParams.get('metaOAuth')", 'OAuth session id allowlist missing');
requireToken("source.searchParams.get('reason')", 'error reason allowlist missing');
requireToken("'Cache-Control': 'no-store, max-age=0'", 'callback response must not be cached');
requireToken("'Referrer-Policy': 'no-referrer'", 'callback response must suppress referrer');
requireToken("'X-Content-Type-Options': 'nosniff'", 'callback response must set nosniff');
requireToken("status: 302", 'callback must redirect to Android');
requireToken("'Location': target.toString()", 'redirect must use fixed constructed target');
forbidToken("searchParams.get('return')", 'caller-controlled return URL must not be accepted');
forbidToken("searchParams.get('redirect')", 'caller-controlled redirect URL must not be accepted');
forbidToken('access_token', 'provider credentials must never enter the Android deep link');
forbidToken('pageAccessToken', 'page credentials must never enter the Android deep link');

console.log('CallTag Android Meta return contract OK: fixed scheme, allowlisted metadata, no credentials, no caller-controlled redirect.');

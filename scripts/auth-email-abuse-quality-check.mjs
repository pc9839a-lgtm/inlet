import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { emailVerificationRequesterKey, issueEmailVerificationToken } from '../functions/api/auth/_auth.js';

const authSource = await fs.readFile(new URL('../functions/api/auth/_auth.js', import.meta.url), 'utf8');
const routeSource = await fs.readFile(new URL('../functions/api/auth/email-verification.js', import.meta.url), 'utf8');
const clientSource = await fs.readFile(new URL('../src/lib/authAccounts.js', import.meta.url), 'utf8');

assert.match(authSource, /CF-Connecting-IP/);
assert.match(authSource, /auth-email-requester:v1:/);
assert.match(authSource, /EMAIL_VERIFICATION_RATE_LIMITED/);
assert.match(authSource, /id >= \? AND id < \?/);
assert.match(authSource, /requesterPurposeBurst/);
assert.match(authSource, /requesterGlobalDaily/);
assert.match(routeSource, /emailVerificationRequesterKey\(request, env\)/);
assert.match(clientSource, /EMAIL_VERIFICATION_RATE_LIMITED/);

function requestWithIp(ip) {
  return new Request('https://pagero.kr/api/auth/email-verification', {
    headers: { 'CF-Connecting-IP': ip },
  });
}

const env = {
  INLET_SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  INLET_AUTH_EMAIL_PROVIDER: 'mock',
  INLET_AUTH_EMAIL_EXPOSE_TOKEN: '1',
};
const firstKey = await emailVerificationRequesterKey(requestWithIp('203.0.113.10'), env);
const sameKey = await emailVerificationRequesterKey(requestWithIp('203.0.113.10'), env);
const otherKey = await emailVerificationRequesterKey(requestWithIp('203.0.113.11'), env);
assert.match(firstKey, /^[a-f0-9]{24}$/);
assert.equal(firstKey, sameKey);
assert.notEqual(firstKey, otherKey);
assert.equal(firstKey.includes('203.0.113.10'), false);

function fakeDb({ purposeBurst = 0, purposeDaily = 0, globalBurst = 0, globalDaily = 0 } = {}) {
  const insertedIds = [];
  return {
    insertedIds,
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.includes('WHERE email = ? AND purpose = ? AND created_at >= ?') && normalized.includes('LIMIT 1')) return null;
              if (normalized.includes('WHERE email = ? AND purpose = ? AND created_at >= ?')) return { count: 0 };
              if (normalized.includes('id >= ? AND id < ? AND purpose = ?') && String(args[3]).includes('T')) {
                return { count: normalized.includes('purpose = ?') && args[3] < new Date(Date.now() - 60 * 60 * 1000).toISOString() ? purposeDaily : purposeBurst };
              }
              if (normalized.includes('id >= ? AND id < ? AND created_at >= ?')) {
                return { count: args[2] < new Date(Date.now() - 60 * 60 * 1000).toISOString() ? globalDaily : globalBurst };
              }
              return null;
            },
            async run() {
              if (normalized.startsWith('INSERT INTO auth_email_verifications')) insertedIds.push(args[0]);
              return { meta: { changes: 1 } };
            },
            async all() { return { results: [] }; },
          };
        },
      };
    },
  };
}

const allowedDb = fakeDb();
const verification = await issueEmailVerificationToken({
  email: 'rate-limit-test@example.com',
  purpose: 'password-reset',
  requesterKey: firstKey,
}, { ...env, DB: allowedDb });
assert.equal(verification.status, 'pending');
assert.equal(allowedDb.insertedIds.length, 1);
assert.match(allowedDb.insertedIds[0], new RegExp(`^email-verification-${firstKey}-`));
assert.equal(allowedDb.insertedIds[0].includes('203.0.113.10'), false);

async function captureCode(options) {
  try {
    await issueEmailVerificationToken({
      email: `blocked-${Math.random()}@example.com`,
      purpose: 'password-reset',
      requesterKey: firstKey,
    }, { ...env, DB: fakeDb(options) });
  } catch (error) {
    return { code: error?.details?.code, status: error?.status, retryAfterSeconds: error?.details?.retryAfterSeconds };
  }
  throw new Error('expected rate limit failure');
}

const purposeBurstError = await captureCode({ purposeBurst: 8 });
assert.equal(purposeBurstError.code, 'EMAIL_VERIFICATION_RATE_LIMITED');
assert.equal(purposeBurstError.status, 429);
assert.equal(purposeBurstError.retryAfterSeconds, 600);

const globalDailyError = await captureCode({ globalDaily: 80 });
assert.equal(globalDailyError.code, 'EMAIL_VERIFICATION_RATE_LIMITED');
assert.equal(globalDailyError.status, 429);
assert.equal(globalDailyError.retryAfterSeconds, 3600);

console.log(JSON.stringify({ ok: true, checks: 18 }, null, 2));

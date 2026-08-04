import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  assertPasswordLoginAllowed,
  finishPasswordLoginTiming,
  passwordLoginRateLimitContext,
} from '../functions/api/auth/_loginRateLimit.js';

const authSource = await fs.readFile(new URL('../functions/api/auth/_auth.js', import.meta.url), 'utf8');
const loginSource = await fs.readFile(new URL('../functions/api/auth/login.js', import.meta.url), 'utf8');
const auditSource = await fs.readFile(new URL('../functions/api/_audit.js', import.meta.url), 'utf8');
const clientSource = await fs.readFile(new URL('../src/lib/authAccounts.js', import.meta.url), 'utf8');
const limiterSource = await fs.readFile(new URL('../functions/api/auth/_loginRateLimit.js', import.meta.url), 'utf8');

assert.match(authSource, /constantTimeTextEqual/);
assert.match(authSource, /pagero-invalid-login-sentinel/);
assert.match(loginSource, /assertPasswordLoginAllowed\(request, env, input\.email/);
assert.match(loginSource, /finishPasswordLoginTiming/);
assert.match(loginSource, /auth\.login_rate_limited/);
assert.match(auditSource, /export async function auditRequestIpHash/);
assert.match(clientSource, /AUTH_LOGIN_RATE_LIMITED/);
assert.match(limiterSource, /action = 'auth\.login_failed'/);
assert.match(limiterSource, /PAIR_BURST_LIMIT = 5/);
assert.match(limiterSource, /REQUESTER_DAILY_LIMIT = 150/);

const env = {
  INLET_AUDIT_HASH_SECRET: 'audit-secret-at-least-32-characters-long',
  INLET_SESSION_SECRET: 'session-secret-at-least-32-characters-long',
};

function requestWithIp(ip) {
  return new Request('https://pagero.kr/api/auth/login', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
  });
}

const firstContext = await passwordLoginRateLimitContext(requestWithIp('203.0.113.20'), env, 'USER@EXAMPLE.COM');
const sameContext = await passwordLoginRateLimitContext(requestWithIp('203.0.113.20'), env, 'user@example.com');
const otherContext = await passwordLoginRateLimitContext(requestWithIp('203.0.113.21'), env, 'user@example.com');
assert.match(firstContext.targetId, /^sha256:[a-f0-9]{64}$/);
assert.match(firstContext.ipHash, /^sha256:[a-f0-9]{64}$/);
assert.deepEqual(firstContext, sameContext);
assert.notEqual(firstContext.ipHash, otherContext.ipHash);
assert.equal(JSON.stringify(firstContext).includes('user@example.com'), false);
assert.equal(JSON.stringify(firstContext).includes('203.0.113.20'), false);

function fakeDb({ pair = 0, target = [0, 0], ip = [0, 0], fail = false } = {}) {
  const queues = {
    target: [...target],
    ip: [...ip],
  };
  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      return {
        bind() {
          return {
            async first() {
              if (fail) throw new Error('audit table unavailable');
              const hasTarget = normalized.includes('target_id = ?');
              const hasIp = normalized.includes('ip = ?');
              if (hasTarget && hasIp) return { count: pair };
              if (hasTarget) return { count: queues.target.shift() ?? 0 };
              if (hasIp) return { count: queues.ip.shift() ?? 0 };
              return { count: 0 };
            },
          };
        },
      };
    },
  };
}

const allowed = await assertPasswordLoginAllowed(requestWithIp('203.0.113.20'), {
  ...env,
  DB: fakeDb(),
}, 'user@example.com');
assert.equal(allowed.targetId, firstContext.targetId);

async function capture(options) {
  try {
    await assertPasswordLoginAllowed(requestWithIp('203.0.113.20'), {
      ...env,
      DB: fakeDb(options),
    }, 'user@example.com');
  } catch (error) {
    return {
      code: error?.details?.code,
      status: error?.status,
      retryAfterSeconds: error?.details?.retryAfterSeconds,
      message: error?.message,
    };
  }
  throw new Error('expected login rate limit');
}

const pairBlocked = await capture({ pair: 5 });
assert.equal(pairBlocked.code, 'AUTH_LOGIN_RATE_LIMITED');
assert.equal(pairBlocked.status, 429);
assert.equal(pairBlocked.retryAfterSeconds, 900);
assert.equal(pairBlocked.message.includes('account'), false);

const accountDailyBlocked = await capture({ target: [0, 30] });
assert.equal(accountDailyBlocked.code, 'AUTH_LOGIN_RATE_LIMITED');
assert.equal(accountDailyBlocked.retryAfterSeconds, 3600);

const requesterBurstBlocked = await capture({ ip: [30, 0] });
assert.equal(requesterBurstBlocked.code, 'AUTH_LOGIN_RATE_LIMITED');
assert.equal(requesterBurstBlocked.retryAfterSeconds, 600);

const failOpen = await assertPasswordLoginAllowed(requestWithIp('203.0.113.20'), {
  ...env,
  DB: fakeDb({ fail: true }),
}, 'user@example.com');
assert.equal(failOpen.targetId, firstContext.targetId);

const timingStartedAt = Date.now();
await finishPasswordLoginTiming(timingStartedAt, { INLET_LOGIN_MIN_RESPONSE_MS: '160' });
assert.ok(Date.now() - timingStartedAt >= 145);

console.log(JSON.stringify({ ok: true, checks: 24 }, null, 2));

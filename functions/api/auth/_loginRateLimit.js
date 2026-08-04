import { auditRequestIpHash, auditSubjectHash } from '../_audit.js';
import { authError, normalizeEmail } from './_auth.js';

const PAIR_BURST_MINUTES = 15;
const PAIR_BURST_LIMIT = 5;
const ACCOUNT_BURST_MINUTES = 15;
const ACCOUNT_BURST_LIMIT = 8;
const ACCOUNT_DAILY_LIMIT = 30;
const REQUESTER_BURST_MINUTES = 10;
const REQUESTER_BURST_LIMIT = 30;
const REQUESTER_DAILY_LIMIT = 150;

function isoBefore(nowMs, minutes) {
  return new Date(nowMs - minutes * 60 * 1000).toISOString();
}

async function failedLoginCount(db, { since, targetId = '', ipHash = '' } = {}) {
  if (!db?.prepare || !since || (!targetId && !ipHash)) return 0;
  const clauses = ["action = 'auth.login_failed'", 'created_at >= ?'];
  const params = [since];
  if (targetId) {
    clauses.push('target_id = ?');
    params.push(targetId);
  }
  if (ipHash) {
    clauses.push('ip = ?');
    params.push(ipHash);
  }
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM audit_logs
    WHERE ${clauses.join(' AND ')}
  `).bind(...params).first();
  return Math.max(0, Number(row?.count || 0));
}

function loginRateLimitError(retryAfterSeconds) {
  return authError('Too many login attempts were made.', 429, {
    code: 'AUTH_LOGIN_RATE_LIMITED',
    retryAfterSeconds: Math.max(60, Number(retryAfterSeconds || 60)),
  });
}

export async function passwordLoginRateLimitContext(request, env = {}, email = '') {
  const normalizedEmail = normalizeEmail(email);
  const [targetId, ipHash] = await Promise.all([
    normalizedEmail ? auditSubjectHash(normalizedEmail, env).catch(() => '') : '',
    auditRequestIpHash(request, env).catch(() => ''),
  ]);
  return { targetId, ipHash };
}

export async function assertPasswordLoginAllowed(request, env = {}, email = '') {
  const context = await passwordLoginRateLimitContext(request, env, email);
  if (!env.DB?.prepare) return context;

  const nowMs = Date.now();
  try {
    if (context.targetId && context.ipHash) {
      const pairBurst = await failedLoginCount(env.DB, {
        targetId: context.targetId,
        ipHash: context.ipHash,
        since: isoBefore(nowMs, PAIR_BURST_MINUTES),
      });
      if (pairBurst >= PAIR_BURST_LIMIT) throw loginRateLimitError(PAIR_BURST_MINUTES * 60);
    }

    if (context.targetId) {
      const accountBurst = await failedLoginCount(env.DB, {
        targetId: context.targetId,
        since: isoBefore(nowMs, ACCOUNT_BURST_MINUTES),
      });
      if (accountBurst >= ACCOUNT_BURST_LIMIT) throw loginRateLimitError(ACCOUNT_BURST_MINUTES * 60);

      const accountDaily = await failedLoginCount(env.DB, {
        targetId: context.targetId,
        since: isoBefore(nowMs, 24 * 60),
      });
      if (accountDaily >= ACCOUNT_DAILY_LIMIT) throw loginRateLimitError(60 * 60);
    }

    if (context.ipHash) {
      const requesterBurst = await failedLoginCount(env.DB, {
        ipHash: context.ipHash,
        since: isoBefore(nowMs, REQUESTER_BURST_MINUTES),
      });
      if (requesterBurst >= REQUESTER_BURST_LIMIT) throw loginRateLimitError(REQUESTER_BURST_MINUTES * 60);

      const requesterDaily = await failedLoginCount(env.DB, {
        ipHash: context.ipHash,
        since: isoBefore(nowMs, 24 * 60),
      });
      if (requesterDaily >= REQUESTER_DAILY_LIMIT) throw loginRateLimitError(60 * 60);
    }
  } catch (error) {
    if (error?.details?.code === 'AUTH_LOGIN_RATE_LIMITED') throw error;
    console.warn('auth login rate limit lookup failed', {
      code: 'AUTH_LOGIN_RATE_LIMIT_LOOKUP_FAILED',
    });
  }
  return context;
}

function boundedLoginMinimumMs(value = '') {
  const parsed = Number(value || 200);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(600, Math.max(160, Math.trunc(parsed)));
}

export async function finishPasswordLoginTiming(startedAt = 0, env = {}) {
  const started = Number(startedAt || 0);
  if (!started) return;
  const remaining = boundedLoginMinimumMs(env.INLET_LOGIN_MIN_RESPONSE_MS) - (Date.now() - started);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

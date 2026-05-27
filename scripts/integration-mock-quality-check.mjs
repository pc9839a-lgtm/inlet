function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockSmtpSend(mode = 'success') {
  if (mode === 'success') {
    return { ok: true, status: 'success', target: 'smtp', messageId: 'mock-smtp-001' };
  }
  if (mode === 'failure') {
    return { ok: false, status: 'failed', target: 'smtp', message: 'SMTP mock rejected recipient' };
  }
  if (mode === 'timeout') {
    await timeout(20);
    return { ok: false, status: 'failed', target: 'smtp', message: 'SMTP mock timed out after 20ms' };
  }
  throw new Error(`Unknown SMTP mock mode: ${mode}`);
}

async function retryMockJob(job, maxAttempts = 3) {
  const logs = [];
  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await job(attempt);
    logs.push({
      target: last.target || 'mock',
      status: last.status,
      message: last.message || last.messageId || '',
      attempt,
      idempotencyKey: `mock-${last.target || 'job'}-${attempt}`,
      at: new Date(0 + attempt * 1000).toISOString(),
    });
    if (last.status === 'success') break;
  }
  const deadLetter = last?.status !== 'success' && logs.length >= maxAttempts;
  return {
    status: last?.status || 'failed',
    logs,
    retry: {
      attempts: logs.length,
      maxAttempts,
      deadLetter,
      deadLetterAt: deadLetter ? new Date(0 + logs.length * 1000).toISOString() : '',
    },
  };
}

function webhookRetryMockData() {
  return {
    retryQueue: {
      total: 2,
      retryable: 1,
      deadLetter: 1,
      entries: [
        { leadId: 'mock-webhook-retry', deliveryStatus: 'failed', attempts: 1, maxAttempts: 3, canRetry: true, deadLetter: false },
        { leadId: 'mock-webhook-dead', deliveryStatus: 'failed', attempts: 3, maxAttempts: 3, canRetry: false, deadLetter: true },
      ],
    },
    deliveryLogs: [
      { leadId: 'mock-webhook-retry', target: 'webhook', status: 'failed', message: 'HTTP 500', idempotencyKey: 'mock-webhook-retry-1' },
      { leadId: 'mock-webhook-dead', target: 'webhook', status: 'failed', message: 'timed out', idempotencyKey: 'mock-webhook-dead-3' },
    ],
  };
}

function oauthState(input = {}) {
  if (!input.clientId || !input.clientSecret) return { status: 'skipped-live', reason: 'oauth-not-configured' };
  if (!input.refreshToken) return { status: 'skipped-live', reason: 'oauth-missing-token' };
  if (input.expired) return { status: 'skipped-live', reason: 'oauth-token-expired' };
  return { status: 'pass', reason: 'oauth-mock-token-present' };
}

const smtpSuccess = await mockSmtpSend('success');
assert(smtpSuccess.status === 'success' && smtpSuccess.messageId, 'SMTP mock success failed');

const smtpFailure = await mockSmtpSend('failure');
assert(smtpFailure.status === 'failed' && smtpFailure.message.includes('rejected'), 'SMTP mock failure failed');

const smtpTimeout = await mockSmtpSend('timeout');
assert(smtpTimeout.status === 'failed' && smtpTimeout.message.includes('timed out'), 'SMTP mock timeout failed');

const retrySuccess = await retryMockJob((attempt) => mockSmtpSend(attempt < 2 ? 'failure' : 'success'));
assert(retrySuccess.status === 'success' && retrySuccess.retry.attempts === 2, 'SMTP retry success mock failed');

const retryDeadLetter = await retryMockJob(() => mockSmtpSend('failure'), 3);
assert(retryDeadLetter.status === 'failed' && retryDeadLetter.retry.deadLetter, 'SMTP dead-letter mock failed');

const webhook = webhookRetryMockData();
assert(webhook.retryQueue.retryable === 1 && webhook.retryQueue.deadLetter === 1, 'webhook retry/dead-letter mock failed');
assert(webhook.deliveryLogs.every((log) => log.idempotencyKey), 'webhook mock idempotency keys missing');

const oauthMissing = oauthState({});
const oauthExpired = oauthState({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', expired: true });
const oauthReady = oauthState({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' });
assert(oauthMissing.status === 'skipped-live' && oauthMissing.reason === 'oauth-not-configured', 'OAuth missing state failed');
assert(oauthExpired.status === 'skipped-live' && oauthExpired.reason === 'oauth-token-expired', 'OAuth expired state failed');
assert(oauthReady.status === 'pass', 'OAuth ready mock failed');

console.log(JSON.stringify({
  ok: true,
  checks: 10,
  localMocks: {
    smtp: ['success', 'failure', 'timeout', 'retry-success', 'dead-letter'],
    webhook: ['retry-queue', 'delivery-logs', 'dead-letter'],
    oauth: ['not-configured', 'expired', 'ready'],
  },
  live: {
    smtp: 'skipped-live',
    oauth: 'skipped-live',
    externalCrm: 'skipped-live',
  },
}, null, 2));

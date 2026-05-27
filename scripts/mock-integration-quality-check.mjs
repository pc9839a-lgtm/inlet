function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
  SKIPPED_LIVE: 'skipped-live',
  NOT_IMPLEMENTED: 'not-implemented',
};

function skippedLive(name, reason) {
  return { name, status: STATUS.SKIPPED_LIVE, reason };
}

async function mockSmtpSend(job = {}, mode = 'success') {
  const idempotencyKey = job.idempotencyKey || `mock-delivery-${job.leadId || 'lead'}`;

  if (mode === 'timeout') {
    return {
      ok: false,
      status: STATUS.FAIL,
      error: 'SMTP send timed out',
      retryable: true,
      deliveryStatus: 'timeout',
      idempotencyKey,
      messageId: null,
      leadId: job.leadId,
    };
  }

  if (mode === 'non-retryable') {
    return {
      ok: false,
      status: STATUS.FAIL,
      error: 'SMTP rejected the sender policy',
      retryable: false,
      deliveryStatus: 'failed',
      idempotencyKey,
      messageId: null,
      leadId: job.leadId,
    };
  }

  if (mode === 'failure') {
    return {
      ok: false,
      status: STATUS.FAIL,
      error: 'SMTP rejected the message',
      retryable: true,
      deliveryStatus: 'failed',
      idempotencyKey,
      messageId: null,
      leadId: job.leadId,
    };
  }

  return {
    ok: true,
    status: STATUS.PASS,
    error: null,
    retryable: false,
    deliveryStatus: 'sent',
    idempotencyKey,
    messageId: `mock-smtp-${job.leadId || 'lead'}`,
    leadId: job.leadId,
  };
}

async function retrySmtp(job, attempts) {
  const history = [];

  for (const mode of attempts) {
    const result = await mockSmtpSend(job, mode);
    history.push(result);
    if (result.ok) {
      return {
        status: STATUS.PASS,
        attempts: history.length,
        deadLetter: false,
        history,
      };
    }
  }

  return {
    status: STATUS.FAIL,
    attempts: history.length,
    deadLetter: true,
    history,
  };
}

function mockWebhookRetryQueue() {
  const entries = [
    {
      id: 'webhook-retry-1',
      leadId: 'lead-101',
      idempotencyKey: 'lead-101:crm-webhook',
      url: 'https://crm.example.test/leads',
      deliveryStatus: 'failed',
      retryable: true,
      attempts: 1,
      nextRetryAt: '2026-05-25T03:05:00.000Z',
      deadLetter: false,
      error: 'HTTP 500',
    },
    {
      id: 'webhook-dead-1',
      leadId: 'lead-102',
      idempotencyKey: 'lead-102:crm-webhook',
      url: 'https://crm.example.test/leads',
      deliveryStatus: 'dead-letter',
      retryable: false,
      attempts: 3,
      nextRetryAt: null,
      deadLetter: true,
      error: 'HTTP 400',
    },
    {
      id: 'webhook-retry-duplicate-attempt',
      leadId: 'lead-101',
      idempotencyKey: 'lead-101:crm-webhook',
      url: 'https://crm.example.test/leads',
      deliveryStatus: 'failed',
      retryable: true,
      attempts: 2,
      nextRetryAt: '2026-05-25T03:10:00.000Z',
      deadLetter: false,
      error: 'HTTP 502',
    },
  ];
  const uniqueDeliveries = new Map();
  for (const entry of entries) {
    const current = uniqueDeliveries.get(entry.idempotencyKey);
    if (!current || entry.attempts > current.attempts) uniqueDeliveries.set(entry.idempotencyKey, entry);
  }
  const compactedEntries = [...uniqueDeliveries.values()];

  return {
    status: STATUS.PASS,
    retryable: compactedEntries.filter((entry) => entry.retryable).length,
    deadLetter: compactedEntries.filter((entry) => entry.deadLetter).length,
    duplicateInputRows: entries.length - compactedEntries.length,
    entries: compactedEntries,
  };
}

function mockOAuthState(config = {}) {
  if (!config.enabled) {
    return {
      provider: config.provider || 'google-calendar',
      status: STATUS.NOT_IMPLEMENTED,
      reason: 'OAuth integration is not enabled for this page',
    };
  }

  if (!config.clientId) {
    return skippedLive(config.provider || 'google-calendar', 'OAuth client ID is missing');
  }

  if (!config.clientSecret) {
    return skippedLive(config.provider || 'google-calendar', 'OAuth client secret is missing');
  }

  if (config.expired) {
    return skippedLive(config.provider || 'google-calendar', 'OAuth token is expired and requires live re-consent');
  }

  if (config.revoked) {
    return skippedLive(config.provider || 'google-calendar', 'OAuth token was revoked and requires live re-consent');
  }

  return {
    provider: config.provider || 'google-calendar',
    status: STATUS.PASS,
    account: config.account || 'operator@example.test',
  };
}

const smtpSuccess = await mockSmtpSend({ leadId: 'lead-success' }, 'success');
const smtpFailure = await mockSmtpSend({ leadId: 'lead-failure' }, 'failure');
const smtpNonRetryable = await mockSmtpSend({ leadId: 'lead-non-retryable' }, 'non-retryable');
const smtpTimeout = await mockSmtpSend({ leadId: 'lead-timeout' }, 'timeout');
const smtpRetrySuccess = await retrySmtp({ leadId: 'lead-retry' }, ['failure', 'success']);
const smtpRetryDeadLetter = await retrySmtp({ leadId: 'lead-dead' }, ['failure', 'timeout', 'failure']);
const webhook = mockWebhookRetryQueue();
const oauth = [
  mockOAuthState({ enabled: false }),
  mockOAuthState({ enabled: true }),
  mockOAuthState({ enabled: true, clientId: 'mock-client' }),
  mockOAuthState({ enabled: true, clientId: 'mock-client', clientSecret: 'mock-secret', expired: true }),
  mockOAuthState({ enabled: true, clientId: 'mock-client', clientSecret: 'mock-secret', revoked: true }),
  mockOAuthState({ enabled: true, clientId: 'mock-client', clientSecret: 'mock-secret' }),
];

function summarizeStatuses(items = []) {
  return items.reduce((summary, item) => {
    const status = item.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;
    return summary;
  }, {});
}

assert(smtpSuccess.ok && smtpSuccess.deliveryStatus === 'sent', 'SMTP mock success failed');
assert(!smtpFailure.ok && smtpFailure.retryable, 'SMTP mock failure should be retryable');
assert(!smtpNonRetryable.ok && !smtpNonRetryable.retryable, 'SMTP mock should include non-retryable failure');
assert(!smtpTimeout.ok && smtpTimeout.error.includes('timed out'), 'SMTP mock timeout should be explicit');
assert(smtpRetrySuccess.status === STATUS.PASS && smtpRetrySuccess.attempts === 2, 'SMTP retry should recover on second attempt');
assert(smtpRetryDeadLetter.deadLetter && smtpRetryDeadLetter.attempts === 3, 'SMTP retry should dead-letter after final failure');
assert(webhook.retryable === 1 && webhook.deadLetter === 1, 'Webhook mock should include retry and dead-letter entries');
assert(webhook.duplicateInputRows === 1, 'Webhook mock should prove duplicate retry rows are compacted');
assert(webhook.entries.every((entry) => entry.idempotencyKey), 'Webhook mock should expose idempotency evidence');
assert(oauth.some((state) => state.status === STATUS.NOT_IMPLEMENTED), 'OAuth mock should include not-implemented state');
assert(oauth.filter((state) => state.status === STATUS.SKIPPED_LIVE).length === 4, 'OAuth mock should include missing id, missing secret, expired, and revoked skipped-live states');
assert(oauth.some((state) => state.status === STATUS.PASS), 'OAuth mock should include connected state');

console.log(JSON.stringify({
  ok: true,
  livePolicy: [
    skippedLive('SMTP live send', 'INLET_SMTP_* credentials are required'),
    skippedLive('External webhook live endpoint', 'Real CRM endpoint is required'),
    skippedLive('OAuth consent', 'OAuth client and operator consent are required'),
  ],
  liveSummary: summarizeStatuses([
    skippedLive('SMTP live send', 'INLET_SMTP_* credentials are required'),
    skippedLive('External webhook live endpoint', 'Real CRM endpoint is required'),
    skippedLive('OAuth consent', 'OAuth client and operator consent are required'),
  ]),
  liveRequirements: {
    SMTP: {
      env: ['INLET_SMTP_HOST', 'INLET_SMTP_PORT', 'INLET_SMTP_USER', 'INLET_SMTP_PASS', 'INLET_SMTP_FROM'],
      manualCheck: 'Send one lead to an operator-owned inbox and confirm delivery log status is sent.',
    },
    webhook: {
      env: ['INLET_INTEGRATION_TIMEOUT_MS'],
      manualCheck: 'Send one lead to a real CRM endpoint and confirm one idempotency key maps to one latest retry record.',
    },
    OAuth: {
      env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      manualCheck: 'Complete consent with a test account, create one event, revoke access, then confirm the revoked state is reported as skipped-live until re-consent.',
    },
    conversion: {
      env: ['public preview URL', 'GTM/Meta/Google Ads/Naver/Kakao account access'],
      manualCheck: 'Run platform diagnostics against the public route, not the editor or template preview route.',
    },
    AI: {
      env: ['OPENAI_API_KEY', 'INLET_AI_QA_LIVE=1'],
      manualCheck: 'Generate one short-prompt draft and confirm the returned blocks remain editable.',
    },
  },
  mocks: {
    SMTP: {
      success: smtpSuccess,
      failure: smtpFailure,
      nonRetryable: smtpNonRetryable,
      timeout: smtpTimeout,
      retrySuccess: smtpRetrySuccess,
      retryDeadLetter: smtpRetryDeadLetter,
    },
    webhook,
    OAuth: oauth,
  },
}, null, 2));

const baseUrl = String(process.env.CALLTAG_EXTERNAL_SMOKE_BASE_URL || 'https://pagero.kr').trim().replace(/\/+$/, '');
const qaSecret = String(process.env.INLET_PRODUCTION_SAVE_QA_SECRET || process.env.CALLTAG_EXTERNAL_SMOKE_QA_SECRET || '').trim();
const timeoutMs = Math.max(3000, Math.min(30000, Number(process.env.CALLTAG_EXTERNAL_SMOKE_TIMEOUT_MS || 12000)));
const mintAttempts = Math.max(1, Math.min(20, Number(process.env.CALLTAG_EXTERNAL_SMOKE_MINT_ATTEMPTS || 12)));
const mintDelayMs = Math.max(0, Math.min(10000, Number(process.env.CALLTAG_EXTERNAL_SMOKE_MINT_DELAY_MS || 2500)));
const qaPrefix = 'CallTag Live QA ';

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 300),
    ...(error?.details && typeof error.details === 'object' ? { details: error.details } : {}),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path, { method = 'GET', session = '', body, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session ? { 'X-Inlet-Session': session } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') fail(`request timed out: ${method} ${path}`, { timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function assertLaunchGate() {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    fail('CallTag external smoke base URL is invalid');
  }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    fail('CallTag external smoke requires an HTTPS origin');
  }
  if (!qaSecret) fail('CallTag external smoke QA credential is missing');
}

async function mintSession() {
  for (let attempt = 1; attempt <= mintAttempts; attempt += 1) {
    const { response, data } = await requestJson('/api/qa/production-save-session', {
      method: 'POST',
      headers: { 'X-Inlet-Production-QA-Secret': qaSecret },
    });
    if (response.ok) {
      const session = String(data.session || '').trim();
      if (!session) fail('CallTag external smoke session mint returned no session');
      if (data.fixture?.platformMaster) fail('CallTag external smoke refuses platform-master fixture');
      return session;
    }
    const details = { status: response.status, code: String(data.code || ''), attempt, attempts: mintAttempts };
    if (response.status !== 404 || attempt >= mintAttempts) fail('CallTag external smoke session mint failed', details);
    if (mintDelayMs) await sleep(mintDelayMs);
  }
  fail('CallTag external smoke session mint retry loop exited unexpectedly');
}

async function refreshSession(session) {
  const { response, data } = await requestJson('/api/auth/session', { session });
  if (!response.ok) fail('CallTag external smoke session refresh failed', { status: response.status, code: String(data.code || '') });
  if (!data.user?.ownerId || !data.user?.email) fail('CallTag external smoke fixture identity is incomplete');
  if (data.user?.platformMaster) fail('CallTag external smoke refuses platform-master fixture');
  return String(data.session || session);
}

async function requireOk(path, session) {
  const { response, data } = await requestJson(path, { session });
  if (!response.ok || data.ok === false) {
    fail(`CallTag integration read failed: ${path}`, { status: response.status, code: String(data.code || data.details?.code || '') });
  }
  return data;
}

async function revokeWebhook(session, id) {
  if (!id) return;
  const { response, data } = await requestJson('/api/calltag/v1/connections', {
    method: 'PATCH',
    session,
    body: { action: 'revoke', connectionId: id },
  });
  if (!response.ok || data.ok === false) {
    fail('CallTag QA Webhook cleanup failed', { status: response.status, code: String(data.code || data.details?.code || '') });
  }
}

async function revokeApiKey(session, id) {
  if (!id) return;
  const { response, data } = await requestJson('/api/calltag/v1/keys', {
    method: 'POST',
    session,
    body: { action: 'revoke', keyId: id },
  });
  if (!response.ok || data.ok === false) {
    fail('CallTag QA API key cleanup failed', { status: response.status, code: String(data.code || data.details?.code || '') });
  }
}

async function cleanupResidue(session) {
  const [webhookData, keyData] = await Promise.all([
    requireOk('/api/calltag/v1/connections', session),
    requireOk('/api/calltag/v1/keys', session),
  ]);

  let webhooks = 0;
  for (const item of Array.isArray(webhookData.connections) ? webhookData.connections : []) {
    if (String(item?.status || '') === 'active' && String(item?.name || '').startsWith(qaPrefix)) {
      await revokeWebhook(session, String(item.id || ''));
      webhooks += 1;
    }
  }

  let keys = 0;
  for (const item of Array.isArray(keyData.keys) ? keyData.keys : []) {
    if (String(item?.status || '') === 'active' && String(item?.name || '').startsWith(qaPrefix)) {
      await revokeApiKey(session, String(item.id || ''));
      keys += 1;
    }
  }
  return { webhooks, keys };
}

async function main() {
  assertLaunchGate();
  let session = await mintSession();
  session = await refreshSession(session);

  const evidence = {
    ok: false,
    targetOrigin: baseUrl,
    checks: [],
    cleanupBefore: null,
    cleanupAfter: null,
    secretsExposed: false,
  };

  let webhookId = '';
  let apiKeyId = '';

  try {
    evidence.cleanupBefore = await cleanupResidue(session);

    await requireOk('/api/calltag/v1/connections', session);
    await requireOk('/api/calltag/v1/keys', session);
    await requireOk('/api/calltag/v1/meta/connections', session);
    await requireOk('/api/calltag/v1/google-forms/connections', session);
    evidence.checks.push({ name: 'authenticated-lists', status: 'ready' });

    const readiness = await requestJson('/api/calltag/v1/readiness');
    if (!readiness.response.ok || readiness.data?.checks?.coreReady !== true) {
      fail('CallTag external readiness core check failed', {
        status: readiness.response.status,
        reason: String(readiness.data?.checks?.d1?.reason || ''),
        missingTables: Array.isArray(readiness.data?.checks?.d1?.missingTables)
          ? readiness.data.checks.d1.missingTables
          : [],
      });
    }
    if (readiness.data?.checks?.providerCredentialEncryption?.ready !== true) {
      fail('CallTag provider credential encryption key is not ready');
    }
    if (readiness.data?.checks?.googleForms?.nativeOauthReady !== true) {
      fail('CallTag Google Forms OAuth runtime is not ready');
    }
    // Fail closed for production release: Meta / Firebase must be ready, not merely present
    // as optional information in an otherwise green CRUD smoke report.
    if (readiness.data?.checks?.meta?.oauthReady !== true) {
      fail('CallTag Meta OAuth is not ready in production');
    }
    if (readiness.data?.checks?.firebase?.ready !== true) {
      fail('CallTag Firebase configuration is not ready in production');
    }
    const pushReadiness = await requestJson('/api/call/push/readiness');
    if (!pushReadiness.response.ok || pushReadiness.data?.ready !== true
        || pushReadiness.data?.firebase?.configured !== true
        || pushReadiness.data?.d1?.bound !== true
        || pushReadiness.data?.d1?.pushDevicesTable !== true) {
      fail('CallTag production FCM/D1 push readiness failed', {
        httpStatus: pushReadiness.response.status,
      });
    }
    evidence.checks.push({
      name: 'runtime-readiness',
      status: 'ready',
      metaOauthReady: true,
      firebaseConfigReady: true,
      pushReadiness: true,
    });

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const webhookName = `${qaPrefix}Webhook ${stamp}`;
    const webhookCreate = await requestJson('/api/calltag/v1/connections', {
      method: 'POST',
      session,
      body: {
        name: webhookName,
        sourceName: 'CallTag QA',
        rawRetentionDays: 1,
      },
    });
    webhookId = String(webhookCreate.data?.connection?.id || '');
    const endpointUrl = String(webhookCreate.data?.endpointUrl || '');
    if (webhookCreate.response.status !== 201 || !webhookId || !endpointUrl.includes('/api/calltag/v1/hooks/ctwh_')) {
      fail('CallTag Webhook create failed', {
        status: webhookCreate.response.status,
        code: String(webhookCreate.data?.code || webhookCreate.data?.details?.code || ''),
      });
    }
    evidence.checks.push({ name: 'webhook-create', status: 'ready' });

    const webhookList = await requireOk('/api/calltag/v1/connections', session);
    const createdWebhook = (Array.isArray(webhookList.connections) ? webhookList.connections : [])
      .find((item) => String(item?.id || '') === webhookId && String(item?.status || '') === 'active');
    if (!createdWebhook || String(createdWebhook.sourceName || '') !== 'CallTag QA') {
      fail('CallTag Webhook readback failed');
    }
    evidence.checks.push({ name: 'webhook-readback', status: 'ready' });

    const apiCreate = await requestJson('/api/calltag/v1/keys', {
      method: 'POST',
      session,
      body: {
        action: 'create',
        name: `${qaPrefix}Direct API ${stamp}`,
      },
    });
    apiKeyId = String(apiCreate.data?.key?.id || '');
    const apiKey = String(apiCreate.data?.key?.apiKey || '');
    if (apiCreate.response.status !== 201 || !apiKeyId || !apiKey.startsWith('ctk_')) {
      fail('CallTag Direct API key create failed', {
        status: apiCreate.response.status,
        code: String(apiCreate.data?.code || apiCreate.data?.details?.code || ''),
      });
    }
    evidence.checks.push({ name: 'direct-api-key-create', status: 'ready' });

    const keyList = await requireOk('/api/calltag/v1/keys', session);
    const createdKey = (Array.isArray(keyList.keys) ? keyList.keys : [])
      .find((item) => String(item?.id || '') === apiKeyId && String(item?.status || '') === 'active');
    if (!createdKey) fail('CallTag Direct API key readback failed');
    evidence.checks.push({ name: 'direct-api-key-readback', status: 'ready' });

    await revokeWebhook(session, webhookId);
    webhookId = '';
    await revokeApiKey(session, apiKeyId);
    apiKeyId = '';
    evidence.checks.push({ name: 'lifecycle-cleanup', status: 'ready' });
  } finally {
    try {
      if (webhookId) await revokeWebhook(session, webhookId);
      if (apiKeyId) await revokeApiKey(session, apiKeyId);
      evidence.cleanupAfter = await cleanupResidue(session);
    } catch (error) {
      evidence.cleanupError = safeError(error);
    }
  }

  evidence.ok = evidence.checks.length === 7
    && evidence.checks.every((check) => check.status === 'ready')
    && !evidence.cleanupError;

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  if (!evidence.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    status: 'failed-live',
    error: safeError(error),
    secretsExposed: false,
  }, null, 2)}\n`);
  process.exitCode = 1;
});

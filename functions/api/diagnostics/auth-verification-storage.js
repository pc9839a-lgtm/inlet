import { issueEmailVerificationToken } from '../auth/_auth.js';
import { withCompatibleAuthVerificationStorage } from '../auth/_verification-storage-compat.js';

function json(status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function safeError(error) {
  return {
    message: String(error?.message || error || 'unknown error').slice(0, 700),
    status: Number(error?.status || 0),
    code: String(error?.details?.code || ''),
  };
}

async function runDiagnostic(env) {
  if (!env.DB?.prepare) return json(200, { ok: false, code: 'D1_BINDING_MISSING' });

  const email = `${crypto.randomUUID()}@example.invalid`;
  const purpose = 'signup';
  const requesterKey = 'a'.repeat(24);
  const stages = {};

  try {
    const verification = await issueEmailVerificationToken({
      email,
      purpose,
      requesterKey,
      suppressDelivery: true,
    }, withCompatibleAuthVerificationStorage(env));
    stages.fullSignupStorageFlow = {
      ok: true,
      purpose: verification?.purpose || '',
      status: verification?.status || '',
      deliveryMode: verification?.delivery?.mode || '',
      deliveryStatus: verification?.delivery?.status || '',
    };
  } catch (error) {
    stages.fullSignupStorageFlow = { ok: false, error: safeError(error) };
  }

  try {
    const result = await env.DB.prepare(`
      DELETE FROM auth_email_verifications
      WHERE email = ? AND purpose = ?
    `).bind(email, purpose).run();
    stages.cleanup = {
      ok: true,
      changes: Number(result?.meta?.changes ?? result?.changes ?? 0),
    };
  } catch (error) {
    stages.cleanup = { ok: false, error: safeError(error) };
  }

  return json(200, {
    ok: stages.fullSignupStorageFlow?.ok === true && stages.cleanup?.ok === true,
    databaseBinding: 'DB',
    syntheticOnly: true,
    userRowsRead: false,
    mailSent: false,
    requestShape: { purpose, requesterKeyLength: requesterKey.length },
    stages,
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET' || request.method === 'POST') return runDiagnostic(env);
  return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'POST'] });
}

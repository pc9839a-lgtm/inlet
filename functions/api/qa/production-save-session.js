import { upsertD1Account } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, jsonResponse, optionsResponse } from '../_shared.js';
import { createSessionToken } from '../auth/_auth.js';

const METHODS = 'POST, OPTIONS';
const QA_ACCOUNT_ID = 'user_production_save_qa';
const QA_EMAIL = 'production-save-qa@pagero.invalid';
const QA_PHONE = '00000000000';
const QA_HOST = 'pagero.kr';

function constantTimeEqual(leftValue = '', rightValue = '') {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function productionQaAuthorized(request, env = {}) {
  const host = new URL(request.url).hostname.toLowerCase();
  if (host !== QA_HOST) return false;
  const expected = String(env.INLET_PRODUCTION_QA_SECRET || '').trim();
  const provided = String(request.headers.get('X-Inlet-Production-QA-Secret') || '').trim();
  return expected.length >= 64 && provided.length >= 64 && constantTimeEqual(provided, expected);
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);
  }

  if (!productionQaAuthorized(request, env)) {
    return jsonResponse(request, env, 404, { ok: false, error: 'Not found.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const now = new Date().toISOString();
    const user = await upsertD1Account(db, {
      id: QA_ACCOUNT_ID,
      ownerId: QA_ACCOUNT_ID,
      name: 'Pagero Production Save QA',
      email: QA_EMAIL,
      phone: QA_PHONE,
      passwordHash: '',
      emailVerified: true,
      emailVerifiedAt: now,
      phoneVerified: false,
      status: 'active',
      source: 'production-save-qa',
      createdAt: now,
      updatedAt: now,
    });

    const session = await createSessionToken({
      ownerId: user.ownerId || user.id || QA_ACCOUNT_ID,
      projectId: '',
      role: 'master',
      email: user.email || QA_EMAIL,
    }, env);

    if (!session) {
      return jsonResponse(request, env, 503, {
        ok: false,
        error: 'Production QA session could not be created.',
        code: 'PRODUCTION_QA_SESSION_FAILED',
      }, METHODS);
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      session,
      fixture: {
        ownerId: user.ownerId || user.id || QA_ACCOUNT_ID,
        email: user.email || QA_EMAIL,
        platformMaster: false,
      },
      secretValuesIncluded: false,
    }, METHODS);
  } catch {
    return jsonResponse(request, env, 503, {
      ok: false,
      error: 'Production QA session could not be created.',
      code: 'PRODUCTION_QA_SESSION_FAILED',
    }, METHODS);
  }
}

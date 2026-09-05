import { upsertD1Account } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { createSessionToken } from '../auth/_auth.js';

const METHODS = 'POST, OPTIONS';
const QA_ACCOUNT_ID = 'user_production_save_qa';
const QA_EMAIL = 'production-save-qa@pagero.invalid';
const QA_PHONE = '00000000000';
const QA_HOST = 'pagero.kr';
const QA_PROJECT_PREFIX = `${QA_ACCOUNT_ID}_qa-save-roundtrip-`;

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

function qaProjectId(value = '') {
  const projectId = String(value || '').trim();
  return projectId.startsWith(QA_PROJECT_PREFIX) ? projectId : '';
}

function pageAssetProjectId(projectId = '') {
  return String(projectId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

async function cleanupQaR2(env = {}, projectId = '') {
  const bucket = env.FILES_BUCKET;
  const assetProjectId = pageAssetProjectId(projectId);
  if (!bucket || typeof bucket.list !== 'function' || typeof bucket.delete !== 'function' || !assetProjectId) {
    return { deleted: 0 };
  }
  let cursor;
  let deleted = 0;
  for (let page = 0; page < 10; page += 1) {
    const result = await bucket.list({
      prefix: `${assetProjectId}/images/`,
      ...(cursor ? { cursor } : {}),
    });
    const keys = Array.isArray(result?.objects)
      ? result.objects.map((object) => String(object?.key || '')).filter(Boolean)
      : [];
    if (keys.length) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    if (!result?.truncated || !result?.cursor) break;
    cursor = result.cursor;
  }
  return { deleted };
}

async function cleanupQaProject(db, env = {}, projectId = '') {
  const safeProjectId = qaProjectId(projectId);
  if (!safeProjectId) return { ok: false, reason: 'invalid-project' };

  const project = await db.prepare(
    'SELECT id, owner_account_id FROM projects WHERE id = ? LIMIT 1',
  ).bind(safeProjectId).first();

  if (project && String(project.owner_account_id || '') !== QA_ACCOUNT_ID) {
    return { ok: false, reason: 'owner-mismatch' };
  }

  const r2 = await cleanupQaR2(env, safeProjectId);
  await db.prepare('DELETE FROM page_revisions WHERE project_id = ?').bind(safeProjectId).run();
  await db.prepare('DELETE FROM pages WHERE project_id = ?').bind(safeProjectId).run();
  await db.prepare('DELETE FROM project_members WHERE project_id = ?').bind(safeProjectId).run();
  await db.prepare('DELETE FROM projects WHERE id = ? AND owner_account_id = ?').bind(safeProjectId, QA_ACCOUNT_ID).run();
  return { ok: true, r2Deleted: r2.deleted };
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
    const input = await readJson(request);
    if (String(input.action || '').trim() === 'cleanup') {
      const cleanup = await cleanupQaProject(db, env, input.projectId || '');
      if (!cleanup.ok) {
        return jsonResponse(request, env, 404, { ok: false, error: 'Not found.' }, METHODS);
      }
      return jsonResponse(request, env, 200, {
        ok: true,
        cleanup: {
          projectId: String(input.projectId || ''),
          r2Deleted: cleanup.r2Deleted,
        },
        secretValuesIncluded: false,
      }, METHODS);
    }

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

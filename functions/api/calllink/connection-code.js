import {
  assertD1,
  authorizeProject,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
  readJson,
  sessionIdentity,
} from '../_shared.js';
import { codeHash, isBillingActive, randomConnectionCode, randomId } from './_shared.js';

const METHODS = 'POST, OPTIONS';
const CODE_LIFETIME_MILLIS = 10 * 60 * 1000;

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const body = await readJson(request);
    const url = new URL(request.url);
    const project = projectFromRequest(url, body, request);
    await authorizeProject(request, env, project, { write: true, tab: 'settings' });
    const identity = await sessionIdentity(request, env);
    const db = assertD1(env);
    const projectRow = await db.prepare(`
      SELECT p.id, p.status, p.billing_status, s.status AS subscription_status
      FROM projects p
      LEFT JOIN subscriptions s ON s.project_id = p.id
      WHERE p.id = ?
      LIMIT 1
    `).bind(project.projectId).first();
    if (!projectRow) {
      const error = new Error('CALLLINK_PROJECT_NOT_FOUND');
      error.status = 404;
      throw error;
    }
    if (projectRow.status !== 'active' || !isBillingActive(projectRow)) {
      const error = new Error('CALLLINK_SUBSCRIPTION_INACTIVE');
      error.status = 402;
      throw error;
    }

    const code = randomConnectionCode();
    const hash = await codeHash(code, env);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_LIFETIME_MILLIS).toISOString();
    await db.batch([
      db.prepare(`
        UPDATE calllink_connection_codes
        SET consumed_at = COALESCE(consumed_at, ?)
        WHERE project_id = ? AND consumed_at IS NULL
      `).bind(now.toISOString(), project.projectId),
      db.prepare(`
        INSERT INTO calllink_connection_codes (
          id, project_id, code_hash, created_by_account_id,
          expires_at, consumed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?)
      `).bind(
        randomId('clcode'),
        project.projectId,
        hash,
        identity?.ownerId || null,
        expiresAt,
        now.toISOString(),
      ),
    ]);

    return jsonResponse(request, env, 200, {
      ok: true,
      connectionCode: code,
      expiresAt,
      expiresInSeconds: CODE_LIFETIME_MILLIS / 1000,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

import {
  apiTokenAuthorized,
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../../_shared.js';
import { randomId, walletBalance } from '../_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    if (!apiTokenAuthorized(request, env)) {
      const error = new Error('CALLLINK_WALLET_ADMIN_AUTH_REQUIRED');
      error.status = 401;
      throw error;
    }
    const body = await readJson(request);
    const projectId = String(body.projectId || '').trim();
    const amount = Math.floor(Number(body.amount || 0));
    const referenceId = String(body.referenceId || '').trim().slice(0, 120);
    const memo = String(body.memo || '페이지로 메시지 충전').trim().slice(0, 240);
    if (!projectId || amount <= 0 || amount > 10000000) {
      const error = new Error('CALLLINK_WALLET_CREDIT_INVALID');
      error.status = 400;
      throw error;
    }

    const db = assertD1(env);
    const project = await db.prepare('SELECT id FROM projects WHERE id = ? LIMIT 1').bind(projectId).first();
    if (!project) {
      const error = new Error('CALLLINK_PROJECT_NOT_FOUND');
      error.status = 404;
      throw error;
    }
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT OR IGNORE INTO calllink_wallets (
        project_id, balance, currency, low_balance_threshold, created_at, updated_at
      ) VALUES (?, 0, 'KRW', 1000, ?, ?)
    `).bind(projectId, now, now).run();
    const current = await walletBalance(db, projectId);
    const next = current.balance + amount;
    const transactionId = randomId('cltx');
    await db.batch([
      db.prepare(`
        UPDATE calllink_wallets
        SET balance = ?, updated_at = ?
        WHERE project_id = ?
      `).bind(next, now, projectId),
      db.prepare(`
        INSERT INTO calllink_wallet_transactions (
          id, project_id, transaction_type, amount, balance_after,
          reference_type, reference_id, memo, created_at
        ) VALUES (?, ?, 'credit', ?, ?, 'payment', ?, ?, ?)
      `).bind(transactionId, projectId, amount, next, referenceId, memo, now),
    ]);

    return jsonResponse(request, env, 200, {
      ok: true,
      transactionId,
      amount,
      balance: next,
      currency: 'KRW',
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

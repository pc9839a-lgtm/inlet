import {
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
} from '../../_shared.js';
import { requireCallLinkDevice } from '../_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const device = await requireCallLinkDevice(request, env);
    const db = assertD1(env);
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 30)));
    const result = await db.prepare(`
      SELECT id, channel, recipient_count, accepted_count, failed_count,
             estimated_cost, provider_group_id, status, error, created_at, updated_at
      FROM calllink_message_logs
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(device.projectId, limit).all();
    return jsonResponse(request, env, 200, {
      ok: true,
      messages: (result?.results || []).map((row) => ({
        id: row.id,
        channel: row.channel,
        recipientCount: Number(row.recipient_count || 0),
        acceptedCount: Number(row.accepted_count || 0),
        failedCount: Number(row.failed_count || 0),
        estimatedCost: Number(row.estimated_cost || 0),
        providerGroupId: row.provider_group_id || '',
        status: row.status || '',
        error: row.error || '',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || '',
      })),
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

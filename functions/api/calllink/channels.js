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
import { channelConfig, requireCallLinkDevice } from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  try {
    const db = assertD1(env);
    if (request.method === 'GET') {
      const authorization = String(request.headers.get('Authorization') || '').trim();
      let projectId = '';
      if (authorization.toLowerCase().startsWith('bearer cl_')) {
        const device = await requireCallLinkDevice(request, env);
        projectId = device.projectId;
      } else {
        const project = projectFromRequest(new URL(request.url), {}, request);
        await authorizeProject(request, env, project, { write: false, tab: 'settings' });
        projectId = project.projectId;
      }
      const channel = await channelConfig(db, projectId);
      return jsonResponse(request, env, 200, {
        ok: true,
        channel: {
          ...channel,
          solapiSecretConfigured: !!String(env.SOLAPI_API_KEY || '').trim()
            && !!String(env.SOLAPI_API_SECRET || '').trim(),
        },
      }, METHODS);
    }

    if (request.method === 'POST') {
      const body = await readJson(request);
      const project = projectFromRequest(new URL(request.url), body, request);
      await authorizeProject(request, env, project, { write: true, tab: 'settings', masterOnly: true });
      const identity = await sessionIdentity(request, env);
      const senderNumber = String(body.senderNumber || '').replace(/[^0-9]/g, '').slice(0, 20);
      const kakaoChannelId = String(body.kakaoChannelId || '').trim().slice(0, 100);
      const kakaoTemplateId = String(body.kakaoTemplateId || '').trim().slice(0, 100);
      const solapiEnabled = body.solapiEnabled === true;
      const fallbackSmsEnabled = body.fallbackSmsEnabled !== false;
      const status = solapiEnabled && senderNumber ? 'active' : 'not_configured';
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO calllink_channels (
          project_id, solapi_enabled, sender_number, kakao_channel_id,
          kakao_template_id, fallback_sms_enabled, status,
          updated_by_account_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          solapi_enabled = excluded.solapi_enabled,
          sender_number = excluded.sender_number,
          kakao_channel_id = excluded.kakao_channel_id,
          kakao_template_id = excluded.kakao_template_id,
          fallback_sms_enabled = excluded.fallback_sms_enabled,
          status = excluded.status,
          updated_by_account_id = excluded.updated_by_account_id,
          updated_at = excluded.updated_at
      `).bind(
        project.projectId,
        solapiEnabled ? 1 : 0,
        senderNumber,
        kakaoChannelId,
        kakaoTemplateId,
        fallbackSmsEnabled ? 1 : 0,
        status,
        identity?.ownerId || null,
        now,
        now,
      ).run();
      return jsonResponse(request, env, 200, {
        ok: true,
        channel: await channelConfig(db, project.projectId),
      }, METHODS);
    }

    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

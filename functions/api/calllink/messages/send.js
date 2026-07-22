import {
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../../_shared.js';
import {
  channelConfig,
  debitWallet,
  estimateMessageCost,
  normalizePhone,
  randomId,
  requireCallLinkDevice,
  solapiRequest,
  walletBalance,
} from '../_shared.js';

const METHODS = 'POST, OPTIONS';
const MAX_MESSAGES = 100;
const MAX_SCHEDULE_MILLIS = 183 * 24 * 60 * 60 * 1000;
const SUPPORTED_CHANNELS = new Set(['sms', 'lms', 'alimtalk']);

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  let logId = '';
  let debited = 0;
  let projectId = '';
  try {
    const db = assertD1(env);
    const device = await requireCallLinkDevice(request, env);
    projectId = device.projectId;
    const body = await readJson(request);
    const channel = String(body.channel || 'sms').trim().toLowerCase();
    if (!SUPPORTED_CHANNELS.has(channel)) {
      const error = new Error('CALLLINK_CHANNEL_UNSUPPORTED');
      error.status = 400;
      throw error;
    }
    const scheduledDate = normalizeScheduledDate(body.scheduledDate);

    const config = await channelConfig(db, projectId);
    if (!config.solapiEnabled || config.status !== 'active' || !config.senderNumber) {
      const error = new Error('CALLLINK_SOLAPI_CHANNEL_INACTIVE');
      error.status = 503;
      throw error;
    }
    if (channel === 'alimtalk' && (!config.kakaoChannelId || !config.kakaoTemplateId)) {
      const error = new Error('CALLLINK_KAKAO_TEMPLATE_NOT_CONFIGURED');
      error.status = 503;
      throw error;
    }

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    if (!rawMessages.length || rawMessages.length > MAX_MESSAGES) {
      const error = new Error('CALLLINK_MESSAGE_COUNT_INVALID');
      error.status = 400;
      throw error;
    }

    const messages = rawMessages.map((item) => normalizeMessage(item, channel, config));
    const estimatedCost = estimateMessageCost(channel, messages, env);
    logId = randomId('clmsg');
    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO calllink_message_logs (
        id, project_id, device_id, provider, channel, recipient_count,
        accepted_count, failed_count, estimated_cost, provider_group_id,
        status, request_json, response_json, error, created_at, updated_at
      ) VALUES (?, ?, ?, 'solapi', ?, ?, 0, 0, ?, '', 'pending', ?, '{}', '', ?, ?)
    `).bind(
      logId,
      projectId,
      device.deviceId,
      channel,
      messages.length,
      estimatedCost,
      JSON.stringify({
        channel,
        count: messages.length,
        scheduledDate,
        templateId: channel === 'alimtalk' ? config.kakaoTemplateId : '',
        fallbackSmsEnabled: channel === 'alimtalk' ? config.fallbackSmsEnabled : false,
      }),
      now,
      now,
    ).run();

    const before = await walletBalance(db, projectId);
    if (before.balance < estimatedCost) {
      const error = new Error('CALLLINK_BALANCE_INSUFFICIENT');
      error.status = 402;
      throw error;
    }
    await debitWallet(
      db,
      projectId,
      estimatedCost,
      logId,
      `${channel} ${messages.length}건${scheduledDate ? ' 예약' : ''} 예상비용`,
    );
    debited = estimatedCost;

    const providerBody = {
      messages,
      strict: false,
      allowDuplicates: false,
      showMessageList: true,
      agent: {
        appId: 'pagero-calllink',
        sdkVersion: 'cloudflare-pages-v1',
        osPlatform: 'cloudflare',
      },
    };
    if (scheduledDate) providerBody.scheduledDate = scheduledDate;

    const providerResponse = await solapiRequest(env, '/messages/v4/send-many/detail', {
      method: 'POST',
      body: JSON.stringify(providerBody),
    });

    const failedCount = Number(providerResponse?.errorCount || 0);
    const acceptedCount = Math.max(0, messages.length - failedCount);
    const providerGroupId = String(
      providerResponse?.groupInfo?.groupId
      || providerResponse?.groupId
      || '',
    );
    const status = failedCount === 0 ? 'accepted' : acceptedCount > 0 ? 'partial' : 'failed';
    await db.prepare(`
      UPDATE calllink_message_logs
      SET accepted_count = ?, failed_count = ?, provider_group_id = ?,
          status = ?, response_json = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      acceptedCount,
      failedCount,
      providerGroupId,
      status,
      JSON.stringify(minimalProviderResponse(providerResponse)),
      new Date().toISOString(),
      logId,
    ).run();

    const wallet = await walletBalance(db, projectId);
    return jsonResponse(request, env, 200, {
      ok: true,
      messageLogId: logId,
      channel,
      scheduledDate,
      acceptedCount,
      failedCount,
      estimatedCost,
      balance: wallet.balance,
      providerGroupId,
      fallbackSmsEnabled: channel === 'alimtalk' && config.fallbackSmsEnabled,
    }, METHODS);
  } catch (error) {
    if (logId && projectId) {
      const db = assertD1(env);
      if (debited > 0) {
        try {
          await refundWallet(db, projectId, debited, logId, '발송 요청 실패 자동 환불');
        } catch {
          // The failed request remains logged for manual reconciliation.
        }
      }
      try {
        await db.prepare(`
          UPDATE calllink_message_logs
          SET status = 'failed', error = ?, updated_at = ?
          WHERE id = ?
        `).bind(
          String(error?.message || error || 'unknown').slice(0, 500),
          new Date().toISOString(),
          logId,
        ).run();
      } catch {
        // Preserve the original API error.
      }
    }
    return handleApiError(request, env, error, METHODS);
  }
}

function normalizeScheduledDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    const error = new Error('CALLLINK_SCHEDULE_DATE_INVALID');
    error.status = 400;
    throw error;
  }
  const now = Date.now();
  if (timestamp <= now + 60 * 1000 || timestamp > now + MAX_SCHEDULE_MILLIS) {
    const error = new Error('CALLLINK_SCHEDULE_DATE_OUT_OF_RANGE');
    error.status = 400;
    throw error;
  }
  return new Date(timestamp).toISOString();
}

function normalizeMessage(item = {}, channel, config) {
  const to = normalizePhone(item.to || item.phone || '');
  if (to.length < 8 || to.length > 20) {
    const error = new Error('CALLLINK_RECIPIENT_INVALID');
    error.status = 400;
    throw error;
  }
  const text = String(item.text || item.fallbackText || '').trim().slice(0, 2000);
  if (channel !== 'alimtalk' && !text) {
    const error = new Error('CALLLINK_MESSAGE_TEXT_REQUIRED');
    error.status = 400;
    throw error;
  }

  if (channel === 'alimtalk') {
    const variables = item.variables && typeof item.variables === 'object' ? item.variables : {};
    return {
      to,
      from: config.senderNumber,
      text,
      autoTypeDetect: true,
      kakaoOptions: {
        pfId: config.kakaoChannelId,
        templateId: config.kakaoTemplateId,
        disableSms: !config.fallbackSmsEnabled,
        variables,
      },
    };
  }

  return {
    to,
    from: config.senderNumber,
    text,
    type: channel === 'lms' ? 'LMS' : 'SMS',
    autoTypeDetect: channel !== 'lms',
  };
}

function minimalProviderResponse(payload = {}) {
  const resultList = Array.isArray(payload.resultList) ? payload.resultList : [];
  return {
    groupId: payload?.groupInfo?.groupId || payload?.groupId || '',
    scheduledDate: payload?.groupInfo?.scheduledDate || payload?.scheduledDate || '',
    errorCount: Number(payload?.errorCount || 0),
    resultList: resultList.slice(0, 100).map((item) => ({
      messageId: item.messageId || '',
      statusCode: item.statusCode || '',
      statusMessage: item.statusMessage || '',
      type: item.type || '',
    })),
  };
}

async function refundWallet(db, projectId, amount, referenceId, memo) {
  const current = await walletBalance(db, projectId);
  const next = current.balance + Math.max(0, Math.ceil(amount));
  const now = new Date().toISOString();
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
      ) VALUES (?, ?, 'refund', ?, ?, 'message', ?, ?, ?)
    `).bind(randomId('cltx'), projectId, Math.max(0, Math.ceil(amount)), next, referenceId, memo, now),
  ]);
}

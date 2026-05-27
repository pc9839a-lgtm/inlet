import { listD1AiDrafts, upsertD1AiDraft, deleteD1AiDraft } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, ensureD1ProjectShell, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson, sessionIdentity } from '../_shared.js';

export const AI_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

export function aiError(message, status = 400, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

export async function requireAiScope(request, env = {}, input = {}, options = {}) {
  const db = assertD1(env);
  const url = new URL(request.url);
  const projectInput = input?.project ? input : { project: input };
  const project = projectFromRequest(url, projectInput, request);
  if (project.projectId) await authorizeProject(request, env, project, options);
  const identity = await sessionIdentity(request, env);
  const ownerId = String(identity?.ownerId || project.ownerId || input.ownerId || '').trim();
  if (!ownerId) throw aiError('Account identity is required for AI key storage.', 401, { code: 'AUTH_SESSION_INVALID' });
  return { db, project, identity, ownerId, projectId: project.projectId || '' };
}

export function keyRecordId(scope = {}) {
  return [scope.ownerId, scope.projectId || 'account', 'openai'].join(':');
}

export function publicAiKeyStatus(record = null, scope = {}) {
  if (!record || record.status === 'deleted') {
    return {
      provider: 'openai',
      status: 'missing',
      ownerId: scope.ownerId || '',
      projectId: scope.projectId || '',
      connected: false,
    };
  }
  return {
    provider: 'openai',
    status: record.status || 'connected',
    ownerId: record.owner_account_id || scope.ownerId || '',
    projectId: record.project_id || scope.projectId || '',
    connected: ['connected', 'valid'].includes(record.status || 'connected'),
    maskedKey: record.last4 ? `sk-...${record.last4}` : '',
    updatedAt: record.updated_at || '',
    lastTestStatus: record.last_test_status || '',
    lastTestMessage: record.last_test_message || '',
    lastTestedAt: record.last_tested_at || '',
  };
}

export async function getAiKeyRecord(db, scope = {}) {
  const row = await db.prepare(`
    SELECT * FROM ai_keys
    WHERE id = ? AND status <> 'deleted'
    LIMIT 1
  `).bind(keyRecordId(scope)).first();
  return row || null;
}

export async function readAiKeyStatus(request, env = {}, input = {}) {
  const scope = await requireAiScope(request, env, input, { tab: 'settings' });
  return publicAiKeyStatus(await getAiKeyRecord(scope.db, scope), scope);
}

export async function saveAiKey(request, env = {}, input = {}) {
  const scope = await requireAiScope(request, env, input, { write: true, tab: 'settings' });
  const apiKey = String(input.apiKey || input.key || '').trim();
  if (!apiKey.startsWith('sk-') || apiKey.length < 20) throw aiError('OpenAI API key format is invalid.', 400, { code: 'AI_KEY_INVALID' });
  const now = new Date().toISOString();
  const cipher = await encryptSecret(apiKey, env);
  await scope.db.prepare(`
    INSERT INTO ai_keys (
      id, owner_account_id, project_id, provider, status, cipher_json, last4, created_at, updated_at
    )
    VALUES (?, ?, ?, 'openai', 'connected', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = 'connected',
      cipher_json = excluded.cipher_json,
      last4 = excluded.last4,
      deleted_at = NULL,
      updated_at = excluded.updated_at
  `).bind(
    keyRecordId(scope),
    scope.ownerId,
    scope.projectId || null,
    JSON.stringify(cipher),
    apiKey.slice(-4),
    now,
    now,
  ).run();
  await writeAiAudit(scope, request, 'ai_key.save', { maskedKey: `sk-...${apiKey.slice(-4)}` });
  return readAiKeyStatus(request, env, input);
}

export async function deleteAiKey(request, env = {}, input = {}) {
  const scope = await requireAiScope(request, env, input, { write: true, tab: 'settings' });
  const now = new Date().toISOString();
  await scope.db.prepare(`
    UPDATE ai_keys SET status = 'deleted', deleted_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, keyRecordId(scope)).run();
  await writeAiAudit(scope, request, 'ai_key.delete', {});
  return publicAiKeyStatus(null, scope);
}

export async function resolveAiKey(request, env = {}, input = {}) {
  const explicit = String(input.apiKey || '').trim();
  if (explicit) return explicit;
  try {
    const scope = await requireAiScope(request, env, input.project || input, { tab: 'edit' });
    const record = await getAiKeyRecord(scope.db, scope);
    if (record?.cipher_json) return decryptSecret(JSON.parse(record.cipher_json), env);
  } catch {
    return String(env.OPENAI_API_KEY || '').trim();
  }
  return String(env.OPENAI_API_KEY || '').trim();
}

export function classifyAiKeyTestError(error = {}) {
  const statusCode = Number(error.status || 0);
  const text = String(error.message || error || '');
  if (/api key is required|missing|OPENAI_API_KEY/i.test(text)) return { status: 'missing', message: 'API key is missing.' };
  if ([400, 401, 403].includes(statusCode) || /invalid api key|incorrect api key|authentication|format/i.test(text)) return { status: 'invalid', message: text || 'API key authentication failed.' };
  if (statusCode === 429 || /quota|billing|rate limit/i.test(text)) return { status: 'quota_rate_limited', message: text || 'API quota, rate limit, or billing needs attention.' };
  return { status: 'request_failed', message: text || 'API key test request failed.' };
}

export async function updateAiKeyTestStatus(request, env = {}, input = {}, result = {}) {
  const scope = await requireAiScope(request, env, input.project || input, { write: true, tab: 'settings' });
  const now = new Date().toISOString();
  const status = String(result.status || 'request_failed');
  const message = String(result.message || '').slice(0, 240);
  await scope.db.prepare(`
    UPDATE ai_keys
    SET last_test_status = ?, last_test_message = ?, last_tested_at = ?, updated_at = ?,
        status = CASE WHEN ? = 'valid' THEN 'connected' ELSE status END
    WHERE id = ? AND status <> 'deleted'
  `).bind(status, message, now, now, status, keyRecordId(scope)).run();
  await writeAiAudit(scope, request, 'ai_key.test', { status, message });
}

export async function listAiDrafts(request, env = {}) {
  const scope = await requireAiScope(request, env, {}, { tab: 'edit' });
  return listD1AiDrafts(scope.db, { projectId: scope.projectId, limit: 20 });
}

export async function saveAiDraft(request, env = {}, input = {}) {
  const scope = await requireAiScope(request, env, input, { write: true, tab: 'edit' });
  const item = input.draft;
  if (!item || typeof item !== 'object') throw aiError('draft object is required.', 400, { code: 'AI_DRAFT_REQUIRED' });
  await ensureD1ProjectShell(scope.db, { ...scope.project, projectId: scope.projectId, ownerId: scope.ownerId });
  const now = new Date().toISOString();
  return upsertD1AiDraft(scope.db, {
    ...item,
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || now,
    savedAt: now,
  }, {
    projectId: scope.projectId,
    createdByAccountId: null,
  });
}

export async function removeAiDraft(request, env = {}, id = '') {
  const scope = await requireAiScope(request, env, {}, { write: true, tab: 'edit' });
  return deleteD1AiDraft(scope.db, { projectId: scope.projectId, id });
}

export async function testOpenAiKey(apiKey = '', model = 'gpt-4.1') {
  const key = requireOpenAiKey(apiKey);
  await callOpenAi({
    key,
    model,
    input: 'Return only OK.',
    max_output_tokens: 16,
  });
}

export async function generateAiDraft(input = {}, model = 'gpt-4.1', apiKey = '') {
  const key = requireOpenAiKey(apiKey);
  const prompt = [
    'Return only valid JSON for an editable mobile landing page draft.',
    'Use Korean copy. Required shape: { "pageTitle": string, "brandName": string, "qualityNote": string, "primaryAction": { "label": string, "target": "form" }, "theme": object, "blocks": array }.',
    'Allowed block types: hero, text, links, form, reservation, faq, map, timer, spacer, divider.',
    `User request: ${JSON.stringify(input || {})}`,
  ].join('\n');
  const data = await callOpenAi({ key, model, input: prompt, max_output_tokens: 2500, temperature: 0.7 });
  const text = responseText(data);
  const draft = JSON.parse(extractJson(text));
  if (!Array.isArray(draft.blocks) || draft.blocks.length < 1) throw aiError('AI draft response did not include editable blocks.', 502, { code: 'AI_DRAFT_BAD_RESPONSE' });
  return draft;
}

export function requireOpenAiKey(value = '') {
  const key = String(value || '').trim();
  if (!key) throw aiError('OpenAI API key is required. Add a customer API key or configure OPENAI_API_KEY.', 500, { code: 'AI_KEY_MISSING' });
  if (!key.startsWith('sk-') || key.length < 20) throw aiError('OpenAI API key format is invalid.', 400, { code: 'AI_KEY_INVALID' });
  return key;
}

export async function aiRouteError(request, env, error) {
  if (error?.details) {
    return jsonResponse(request, env, Number(error.status || 500), {
      ok: false,
      error: String(error.message || error),
      ...error.details,
    }, AI_METHODS);
  }
  return handleApiError(request, env, error, AI_METHODS);
}

export { jsonResponse, optionsResponse, readJson };

async function callOpenAi({ key, model, input, max_output_tokens = 1200, temperature = 0.2 }) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, max_output_tokens, temperature }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = aiError(data?.error?.message || `OpenAI request failed: ${res.status}`, res.status || 502, { code: data?.error?.code || 'OPENAI_REQUEST_FAILED' });
    throw error;
  }
  return data;
}

function responseText(data = {}) {
  if (typeof data.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

function extractJson(text = '') {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first < 0 || last < first) throw aiError('AI response did not include JSON.', 502, { code: 'AI_DRAFT_BAD_RESPONSE' });
  return trimmed.slice(first, last + 1);
}

async function writeAiAudit(scope = {}, request, action = '', metadata = {}) {
  try {
    await scope.db.prepare(`
      INSERT INTO audit_logs (id, project_id, actor_account_id, action, target_type, target_id, ip, user_agent, metadata_json)
      VALUES (?, ?, ?, ?, 'ai_key', ?, ?, ?, ?)
    `).bind(
      `${action}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      scope.projectId || null,
      scope.ownerId || null,
      action,
      keyRecordId(scope),
      request.headers.get('CF-Connecting-IP') || '',
      request.headers.get('User-Agent') || '',
      JSON.stringify(metadata || {}),
    ).run();
  } catch {
    // Audit failure must not block the operator action.
  }
}

async function encryptSecret(secret = '', env = {}) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(env);
  const encoded = new TextEncoder().encode(secret);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded));
  return { algorithm: 'AES-GCM', iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(encrypted) };
}

async function decryptSecret(cipher = {}, env = {}) {
  const key = await aesKey(env);
  const iv = base64UrlToBytes(cipher.iv || '');
  const encrypted = base64UrlToBytes(cipher.ciphertext || '');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
  return new TextDecoder().decode(plain);
}

async function aesKey(env = {}) {
  const secret = String(env.INLET_AI_KEY_SECRET || env.INLET_SESSION_SECRET || env.INLET_API_TOKEN || 'inlet-local-ai-key-secret');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value = '') {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

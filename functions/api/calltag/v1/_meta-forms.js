import { decryptProviderCredential } from './_credentials.js';
import { metaGraphVersion } from './_meta-graph.js';
import { completeMetaOauthSession } from './_meta-oauth.js';
import { ensureMetaLeadSchema } from './_meta-schema.js';
import { leadError, safeOwner, text } from './_utils.js';

const MAX_FORMS_PER_PAGE = 100;
const MAX_SELECTED_FORMS = 100;

export async function ensureMetaFormFilterSchema(db) {
  await ensureMetaLeadSchema(db);
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS calltag_meta_form_filters (
      connection_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      form_id TEXT NOT NULL,
      form_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (connection_id, form_id),
      FOREIGN KEY (connection_id) REFERENCES calltag_meta_connections(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_calltag_meta_form_filters_owner_page
    ON calltag_meta_form_filters(owner_id, page_id, form_id)
  `).run();
}

export async function listMetaOauthLeadForms(db, ownerId = '', sessionId = '', env = {}) {
  await ensureMetaFormFilterSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const id = text(sessionId, 160);
  const row = await db.prepare(`
    SELECT id, owner_id, status, user_token_envelope, expires_at
    FROM calltag_meta_oauth_sessions
    WHERE id = ? AND owner_id = ?
    LIMIT 1
  `).bind(id, safeOwnerId).first();
  if (!row?.id) throw leadError('Meta OAuth session was not found.', 404, 'CALLTAG_META_OAUTH_SESSION_NOT_FOUND');
  if (Number(row.expires_at || 0) <= Date.now()) {
    throw leadError('Meta OAuth session expired.', 410, 'CALLTAG_META_OAUTH_EXPIRED');
  }
  if (String(row.status || '') !== 'authorized' || !row.user_token_envelope) {
    throw leadError('Meta OAuth session is not ready.', 409, 'CALLTAG_META_OAUTH_NOT_AUTHORIZED');
  }

  const userToken = await decryptProviderCredential(
    env,
    row.user_token_envelope,
    oauthCredentialAad(safeOwnerId, id),
  );
  const pages = await fetchManagedPages(env, userToken);
  const forms = [];
  for (const page of pages) {
    const pageForms = await fetchLeadForms(env, page).catch(() => []);
    for (const form of pageForms) {
      if (forms.length >= MAX_SELECTED_FORMS) break;
      forms.push({
        id: form.id,
        name: `${page.name || 'Meta Page'} · ${form.name || '리드폼'}`,
        pageId: page.id,
        pageName: page.name,
        formId: form.id,
        formName: form.name,
        status: form.status,
      });
    }
    if (forms.length >= MAX_SELECTED_FORMS) break;
  }
  return forms;
}

export async function completeMetaOauthFormsSession(
  db,
  ownerId = '',
  sessionId = '',
  selectedFormIds = [],
  env = {},
) {
  await ensureMetaFormFilterSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const selected = normalizeIds(selectedFormIds).slice(0, MAX_SELECTED_FORMS);
  if (!selected.length) {
    throw leadError('Select at least one Meta lead form.', 400, 'CALLTAG_META_FORM_SELECTION_REQUIRED');
  }

  const forms = await listMetaOauthLeadForms(db, safeOwnerId, sessionId, env);
  const selectedSet = new Set(selected);
  const chosen = forms.filter((form) => selectedSet.has(form.formId));
  if (!chosen.length) {
    throw leadError('Selected Meta lead forms are unavailable.', 409, 'CALLTAG_META_FORM_NOT_AVAILABLE');
  }

  const pageIds = Array.from(new Set(chosen.map((form) => form.pageId).filter(Boolean)));
  const result = await completeMetaOauthSession(db, safeOwnerId, sessionId, pageIds, env);

  for (const item of Array.isArray(result?.results) ? result.results : []) {
    if (!item?.ok || !item?.connection?.id || !item?.pageId) continue;
    const pageForms = chosen.filter((form) => form.pageId === item.pageId);
    await replaceConnectionFormFilters(
      db,
      safeOwnerId,
      item.connection.id,
      item.pageId,
      pageForms,
    );
  }

  return {
    ...result,
    selectedForms: chosen.map((form) => ({
      formId: form.formId,
      formName: form.formName,
      pageId: form.pageId,
      pageName: form.pageName,
    })),
  };
}

export async function filterMetaLeadEventsBySelectedForms(db, events = []) {
  await ensureMetaFormFilterSchema(db);
  const output = [];
  for (const event of Array.isArray(events) ? events : []) {
    const pageId = normalizeId(event?.pageId);
    const formId = normalizeId(event?.formId);
    if (!pageId) continue;

    const connection = await db.prepare(`
      SELECT id FROM calltag_meta_connections
      WHERE page_id = ? AND status IN ('active', 'error')
      LIMIT 1
    `).bind(pageId).first();
    if (!connection?.id) {
      output.push(event);
      continue;
    }

    const filterCountRow = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM calltag_meta_form_filters
      WHERE connection_id = ?
    `).bind(connection.id).first();
    const filterCount = Number(filterCountRow?.count || 0);
    if (filterCount === 0) {
      output.push(event);
      continue;
    }
    if (!formId) continue;

    const allowed = await db.prepare(`
      SELECT 1 AS allowed
      FROM calltag_meta_form_filters
      WHERE connection_id = ? AND form_id = ?
      LIMIT 1
    `).bind(connection.id, formId).first();
    if (allowed?.allowed) output.push(event);
  }
  return output;
}

async function replaceConnectionFormFilters(db, ownerId, connectionId, pageId, forms) {
  await db.prepare(`DELETE FROM calltag_meta_form_filters WHERE connection_id = ? AND owner_id = ?`)
    .bind(connectionId, ownerId).run();
  for (const form of forms.slice(0, MAX_SELECTED_FORMS)) {
    await db.prepare(`
      INSERT INTO calltag_meta_form_filters (
        connection_id, owner_id, page_id, form_id, form_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(connection_id, form_id) DO UPDATE SET
        form_name = excluded.form_name,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      connectionId,
      ownerId,
      pageId,
      normalizeId(form.formId),
      text(form.formName || form.name, 240),
    ).run();
  }
}

async function fetchManagedPages(env, userToken) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion(env)}/me/accounts`);
  url.searchParams.set('fields', 'id,name,access_token,tasks');
  url.searchParams.set('limit', '100');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${userToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const data = await readJson(response);
  if (!response.ok || data?.error || !Array.isArray(data?.data)) {
    throw leadError('Meta Pages could not be loaded.', 502, 'CALLTAG_META_PAGES_FETCH_FAILED');
  }
  return data.data.slice(0, 100).map((page) => ({
    id: normalizeId(page?.id),
    name: text(page?.name, 160),
    accessToken: String(page?.access_token || '').trim(),
  })).filter((page) => page.id && page.accessToken.length >= 20);
}

async function fetchLeadForms(env, page) {
  const url = new URL(`https://graph.facebook.com/${metaGraphVersion(env)}/${encodeURIComponent(page.id)}/leadgen_forms`);
  url.searchParams.set('fields', 'id,name,status');
  url.searchParams.set('limit', String(MAX_FORMS_PER_PAGE));
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${page.accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  const data = await readJson(response);
  if (!response.ok || data?.error || !Array.isArray(data?.data)) {
    throw leadError('Meta lead forms could not be loaded.', 502, 'CALLTAG_META_FORMS_FETCH_FAILED');
  }
  return data.data.slice(0, MAX_FORMS_PER_PAGE).map((form) => ({
    id: normalizeId(form?.id),
    name: text(form?.name || '리드폼', 240),
    status: text(form?.status, 80),
  })).filter((form) => form.id);
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' ? body : {};
}

function oauthCredentialAad(ownerId, sessionId) {
  return `calltag:meta-oauth-user-token:v1:${text(ownerId, 160)}:${text(sessionId, 160)}`;
}

function normalizeIds(value) {
  const list = Array.isArray(value) ? value : [value];
  return Array.from(new Set(list.map(normalizeId).filter(Boolean)));
}

function normalizeId(value = '') {
  const id = String(value || '').trim();
  return /^[0-9]{3,40}$/.test(id) ? id : '';
}

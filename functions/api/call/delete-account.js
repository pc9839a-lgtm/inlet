import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { AUTH_METHODS, getSessionAccount } from '../auth/_auth.js';
import { ensureCalllinkSchema } from './_shared.js';

const OWNER_DELETE_RULES = Object.freeze([
  ['calltag_google_forms_oauth_sessions', 'owner_id = ?'],
  ['calltag_google_forms_connections', 'owner_id = ?'],
  ['calltag_meta_oauth_sessions', 'owner_id = ?'],
  ['calltag_meta_connections', 'owner_id = ?'],
  ['calltag_webhook_raw_events', 'owner_id = ?'],
  ['calltag_webhook_mapping_versions', 'owner_id = ?'],
  ['calltag_webhook_connections', 'owner_id = ?'],
  ['calltag_lead_audit', 'owner_id = ?'],
  ['calltag_lead_events', 'owner_id = ?'],
  ['calltag_lead_customers', 'owner_id = ?'],
  ['calltag_api_keys', 'owner_id = ?'],
  ['calltag_pagero_leads', 'owner_id = ?'],
  ['calltag_push_devices', 'owner_id = ?'],
  ['billing_subscriptions', 'owner_id = ?'],
  ['billing_accounts', 'owner_id = ?'],
  ['referral_codes', 'owner_id = ?'],
  ['partner_commissions', 'referrer_owner_id = ? OR referred_owner_id = ?'],
  ['referrals', 'referrer_owner_id = ? OR referred_owner_id = ?'],
  ['calllink_entitlements', 'owner_id = ?'],
  ['calllink_profiles', 'owner_id = ?'],
]);

async function existingTableNames(db) {
  const result = await db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `).all();
  return new Set((result?.results || []).map((row) => String(row?.name || '')).filter(Boolean));
}

function ownerDeleteStatements(db, tables, ownerId) {
  const statements = [];
  for (const [table, where] of OWNER_DELETE_RULES) {
    if (!tables.has(table)) continue;
    const bindCount = (where.match(/\?/g) || []).length;
    const values = Array.from({ length: bindCount }, () => ownerId);
    statements.push(db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(...values));
  }
  return statements;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  }

  try {
    const db = assertD1(env);
    const input = await readJson(request);
    if (String(input.confirm || '').trim() !== 'DELETE') {
      return jsonResponse(request, env, 400, {
        ok: false,
        error: 'Account deletion confirmation is required.',
        details: { code: 'ACCOUNT_DELETE_CONFIRM_REQUIRED' },
      }, AUTH_METHODS);
    }

    const { user } = await getSessionAccount(request, env, input);
    const ownerId = String(user.ownerId || user.id || '').trim();
    const originalEmail = String(user.email || '').trim().toLowerCase();
    if (!ownerId) {
      return jsonResponse(request, env, 404, {
        ok: false,
        error: 'Account was not found.',
        details: { code: 'AUTH_ACCOUNT_NOT_FOUND' },
      }, AUTH_METHODS);
    }

    await ensureCalllinkSchema(db);
    const tables = await existingTableNames(db);
    const statements = ownerDeleteStatements(db, tables, ownerId);

    // Keep only a non-reversible phone HMAC tombstone used to stop lifetime referral-bonus reuse.
    // Remove the deleted account id from that ledger so the retained anti-abuse key is not linked
    // back to the deleted account record.
    if (tables.has('calltag_referral_identity_claims')) {
      statements.unshift(db.prepare(`
        UPDATE calltag_referral_identity_claims
        SET referred_owner_id = 'deleted:' || substr(phone_hash, 1, 24)
        WHERE referred_owner_id = ?
      `).bind(ownerId));
    }

    if (tables.has('auth_email_verifications') && originalEmail) {
      statements.push(db.prepare(
        'DELETE FROM auth_email_verifications WHERE lower(email) = ?'
      ).bind(originalEmail));
    }

    const deletedEmail = `deleted-${crypto.randomUUID()}@deleted.invalid`;
    statements.push(db.prepare(`
      UPDATE accounts
      SET status = 'deleted_pending_retention',
          email = ?,
          name = '',
          phone = NULL,
          password_hash = '',
          email_verified_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(deletedEmail, ownerId));

    await db.batch(statements);

    return jsonResponse(request, env, 200, {
      ok: true,
      deleted: true,
      deletedAt: new Date().toISOString(),
      retained: {
        referralAbusePreventionFingerprint: true,
        rawPhoneRetainedForReferralAbusePrevention: false,
        accountContentRetained: false,
      },
    }, AUTH_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, AUTH_METHODS);
  }
}

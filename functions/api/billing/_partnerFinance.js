const ALLOWED_RATE_BPS = new Set([2000, 5000]);

function text(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

export async function ensurePartnerFinanceSchema(db) {
  if (!db?.prepare) throw new Error('PARTNER_FINANCE_DB_REQUIRED');

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      owner_id TEXT PRIMARY KEY,
      commission_rate_bps INTEGER NOT NULL DEFAULT 2000,
      status TEXT NOT NULL DEFAULT 'active',
      updated_by_owner_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(commission_rate_bps IN (2000, 5000)),
      CHECK(status IN ('active', 'paused'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_settlements (
      settlement_id TEXT PRIMARY KEY,
      partner_owner_id TEXT NOT NULL,
      settlement_month TEXT NOT NULL,
      commission_count INTEGER NOT NULL DEFAULT 0,
      gross_sales_krw INTEGER NOT NULL DEFAULT 0,
      payout_amount_krw INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      paid_at TEXT NOT NULL DEFAULT '',
      paid_by_owner_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(status IN ('processing', 'paid', 'cancelled', 'review'))
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_settlements_owner_month
    ON partner_settlements(partner_owner_id, settlement_month, created_at DESC)
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_settlement_items (
      settlement_id TEXT NOT NULL,
      commission_id INTEGER NOT NULL UNIQUE,
      base_amount_krw INTEGER NOT NULL DEFAULT 0,
      commission_amount_krw INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(settlement_id, commission_id)
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_settlement_items_settlement
    ON partner_settlement_items(settlement_id, commission_id)
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_finance_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_owner_id TEXT NOT NULL,
      target_owner_id TEXT NOT NULL,
      action TEXT NOT NULL,
      settlement_month TEXT NOT NULL DEFAULT '',
      amount_krw INTEGER NOT NULL DEFAULT 0,
      old_rate_bps INTEGER NOT NULL DEFAULT 0,
      new_rate_bps INTEGER NOT NULL DEFAULT 0,
      settlement_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_partner_finance_audit_target_created
    ON partner_finance_audit(target_owner_id, created_at DESC)
  `).run();
}

export async function resolvePartnerCommissionRateBps(db, ownerId = '') {
  await ensurePartnerFinanceSchema(db);
  const safeOwnerId = text(ownerId, 120);
  if (!safeOwnerId) return 2000;
  const row = await db.prepare(`
    SELECT commission_rate_bps
    FROM partner_profiles
    WHERE owner_id = ? AND status = 'active'
    LIMIT 1
  `).bind(safeOwnerId).first();
  const rate = Number(row?.commission_rate_bps || 2000);
  return ALLOWED_RATE_BPS.has(rate) ? rate : 2000;
}

export function normalizePartnerRateBps(value) {
  const numeric = Number(value || 0);
  if (numeric === 20 || numeric === 2000) return 2000;
  if (numeric === 50 || numeric === 5000) return 5000;
  return 0;
}

export function normalizeSettlementMonth(value = '') {
  const month = text(value, 7);
  return /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? month : '';
}

export function createSettlementId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
  return `cts_${Date.now().toString(36)}_${token}`;
}

export async function writePartnerFinanceAudit(db, input = {}) {
  await ensurePartnerFinanceSchema(db);
  await db.prepare(`
    INSERT INTO partner_finance_audit (
      actor_owner_id, target_owner_id, action, settlement_month, amount_krw,
      old_rate_bps, new_rate_bps, settlement_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    text(input.actorOwnerId, 120),
    text(input.targetOwnerId, 120),
    text(input.action, 80),
    text(input.settlementMonth, 7),
    Math.max(0, Math.trunc(Number(input.amountKrw || 0))),
    Math.max(0, Math.trunc(Number(input.oldRateBps || 0))),
    Math.max(0, Math.trunc(Number(input.newRateBps || 0))),
    text(input.settlementId, 120),
  ).run();
}

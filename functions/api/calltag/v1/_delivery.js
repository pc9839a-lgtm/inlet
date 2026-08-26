import { ensureUniversalLeadSchema } from './_schema.js';
import { publicLeadEvent } from './_store.js';
import { safeOwner, text } from './_utils.js';

/**
 * App delivery view for canonical leads.
 *
 * Existing PageRo Android builds still consume the legacy /api/call/pagero/leads queue because
 * that path also owns PageRo-specific SMS automation. Phase 1 dual-writes PageRo into the
 * canonical store, so Android can exclude source_type=pagero here to prevent importing the same
 * inquiry twice while the two delivery paths coexist.
 */
export async function listUniversalLeadsForDelivery(db, ownerId = '', options = {}) {
  await ensureUniversalLeadSchema(db);
  const safeOwnerId = safeOwner(ownerId);
  const after = Math.max(0, Number(options.after || 0));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 50)));
  const excludedSourceTypes = normalizeExcludedSourceTypes(options.excludeSourceTypes);

  const exclusions = excludedSourceTypes.length
    ? ` AND lower(source_type) NOT IN (${excludedSourceTypes.map(() => '?').join(',')})`
    : '';
  const rows = await db.prepare(`
    SELECT * FROM calltag_lead_events
    WHERE owner_id = ? AND id > ? AND status IN ('ACCEPTED', 'DELIVERED')${exclusions}
    ORDER BY id ASC
    LIMIT ?
  `).bind(safeOwnerId, after, ...excludedSourceTypes, limit + 1).all();
  const all = rows?.results || [];
  const selected = all.slice(0, limit);
  const hasMore = all.length > limit;

  if (selected.length) {
    const ids = selected.map((row) => Number(row.id || 0)).filter(Boolean);
    const placeholders = ids.map(() => '?').join(',');
    if (placeholders) {
      await db.prepare(`
        UPDATE calltag_lead_events
        SET status = 'DELIVERED',
            delivered_at = CASE WHEN delivered_at = '' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE owner_id = ? AND status = 'ACCEPTED' AND id IN (${placeholders})
      `).bind(safeOwnerId, ...ids).run();
    }
  }

  const nextAfter = selected.length ? Number(selected[selected.length - 1].id || after) : after;
  return { leads: selected.map(publicLeadEvent), nextAfter, hasMore };
}

export function parseExcludedSourceTypes(url) {
  if (!url?.searchParams) return [];
  const values = [];
  for (const raw of url.searchParams.getAll('excludeSourceType')) {
    for (const part of String(raw || '').split(',')) values.push(part);
  }
  return normalizeExcludedSourceTypes(values);
}

function normalizeExcludedSourceTypes(value) {
  const values = Array.isArray(value) ? value : [value];
  return Array.from(new Set(values
    .map((item) => text(item, 80).toLowerCase())
    .filter((item) => /^[a-z0-9_.:-]{1,80}$/.test(item))))
    .slice(0, 8);
}

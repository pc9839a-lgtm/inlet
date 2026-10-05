const PAGE_VARIANT_JSON_MAX_BYTES = 1_850_000;
const OPEN_EXPERIMENT_STATUSES = new Set(['draft', 'running', 'paused']);
const TERMINAL_EXPERIMENT_STATUSES = new Set(['completed', 'canceled']);

function assertD1(db) {
  if (!db || typeof db.prepare !== 'function') {
    const error = new Error('D1 binding is not configured.');
    error.code = 'D1_BINDING_MISSING';
    throw error;
  }
}

function id(prefix = 'ab') {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return fallback;
  }
}

function stringifyPage(page = {}) {
  const json = JSON.stringify(page && typeof page === 'object' ? page : {});
  const bytes = new TextEncoder().encode(json).length;
  if (bytes > PAGE_VARIANT_JSON_MAX_BYTES) {
    const error = new Error('PAGE_VARIANT_DATA_TOO_LARGE');
    error.status = 413;
    error.code = 'PAGE_VARIANT_DATA_TOO_LARGE';
    error.details = { code: error.code, bytes, maxBytes: PAGE_VARIANT_JSON_MAX_BYTES };
    throw error;
  }
  return json;
}

function conflict(message, code) {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  error.details = { code };
  return error;
}

export function decodeD1PageExperiment(row = {}) {
  return {
    id: String(row.id || ''),
    projectId: String(row.project_id || ''),
    pageId: String(row.page_id || ''),
    name: String(row.name || ''),
    status: String(row.status || 'draft'),
    assignmentSalt: String(row.assignment_salt || ''),
    assignmentVersion: Number(row.assignment_version || 1),
    winnerVariantId: String(row.winner_variant_id || ''),
    startedAt: String(row.started_at || ''),
    endedAt: String(row.ended_at || ''),
    createdByAccountId: String(row.created_by_account_id || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

export function decodeD1PageVariant(row = {}) {
  return {
    id: String(row.id || ''),
    experimentId: String(row.experiment_id || ''),
    projectId: String(row.project_id || ''),
    pageId: String(row.page_id || ''),
    key: String(row.variant_key || ''),
    name: String(row.name || ''),
    status: String(row.status || 'active'),
    trafficWeight: Number(row.traffic_weight || 0),
    page: parseJson(row.page_json, {}),
    sourceRevisionId: String(row.source_revision_id || ''),
    sourceRevision: Number(row.source_revision || 0),
    createdByAccountId: String(row.created_by_account_id || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

async function allRows(statement) {
  const result = await statement.all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function runStatements(db, statements = []) {
  if (typeof db.batch === 'function') {
    return db.batch(statements);
  }
  const results = [];
  for (const statement of statements) results.push(await statement.run());
  return results;
}

export async function listD1PageExperiments(db, { projectId, pageId } = {}) {
  assertD1(db);
  const rows = await allRows(db.prepare(`
    SELECT *
    FROM page_experiments
    WHERE project_id = ? AND page_id = ?
    ORDER BY created_at DESC, id DESC
  `).bind(String(projectId || ''), String(pageId || '')));
  return rows.map(decodeD1PageExperiment);
}

export async function getD1PageExperiment(db, { projectId, pageId, experimentId } = {}) {
  assertD1(db);
  const row = await db.prepare(`
    SELECT *
    FROM page_experiments
    WHERE id = ? AND project_id = ? AND page_id = ?
    LIMIT 1
  `).bind(String(experimentId || ''), String(projectId || ''), String(pageId || '')).first();
  if (!row) return null;
  const variants = await listD1PageVariants(db, {
    projectId,
    pageId,
    experimentId: row.id,
  });
  return { ...decodeD1PageExperiment(row), variants };
}

export async function getD1OpenPageExperiment(db, { projectId, pageId } = {}) {
  assertD1(db);
  const row = await db.prepare(`
    SELECT *
    FROM page_experiments
    WHERE project_id = ?
      AND page_id = ?
      AND status IN ('draft', 'running', 'paused')
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `).bind(String(projectId || ''), String(pageId || '')).first();
  if (!row) return null;
  return getD1PageExperiment(db, {
    projectId,
    pageId,
    experimentId: row.id,
  });
}

export async function listD1PageVariants(db, { projectId, pageId, experimentId } = {}) {
  assertD1(db);
  const rows = await allRows(db.prepare(`
    SELECT *
    FROM page_variants
    WHERE experiment_id = ? AND project_id = ? AND page_id = ?
    ORDER BY variant_key ASC, id ASC
  `).bind(String(experimentId || ''), String(projectId || ''), String(pageId || '')));
  return rows.map(decodeD1PageVariant);
}

export async function getD1PageVariant(db, { projectId, pageId, experimentId, variantKey } = {}) {
  assertD1(db);
  const row = await db.prepare(`
    SELECT *
    FROM page_variants
    WHERE experiment_id = ?
      AND project_id = ?
      AND page_id = ?
      AND variant_key = ?
    LIMIT 1
  `).bind(
    String(experimentId || ''),
    String(projectId || ''),
    String(pageId || ''),
    String(variantKey || '').toUpperCase(),
  ).first();
  return row ? decodeD1PageVariant(row) : null;
}

export async function createD1PageExperiment(db, {
  projectId,
  pageId,
  name = '',
  createdByAccountId = null,
} = {}) {
  assertD1(db);
  const safeProjectId = String(projectId || '').trim();
  const safePageId = String(pageId || '').trim();
  const page = await db.prepare(`
    SELECT id, project_id, slug, title, page_json, revision, updated_at
    FROM pages
    WHERE id = ? AND project_id = ?
    LIMIT 1
  `).bind(safePageId, safeProjectId).first();
  if (!page) {
    const error = new Error('Page not found.');
    error.status = 404;
    error.code = 'PAGE_NOT_FOUND';
    throw error;
  }

  const open = await db.prepare(`
    SELECT id, status
    FROM page_experiments
    WHERE project_id = ?
      AND page_id = ?
      AND status IN ('draft', 'running', 'paused')
    LIMIT 1
  `).bind(safeProjectId, safePageId).first();
  if (open) {
    throw conflict('An open experiment already exists for this page.', 'PAGE_EXPERIMENT_ALREADY_OPEN');
  }

  const sourceRevision = await db.prepare(`
    SELECT id, revision
    FROM page_revisions
    WHERE project_id = ? AND page_id = ? AND revision = ?
    LIMIT 1
  `).bind(safeProjectId, safePageId, Number(page.revision || 0)).first();

  const now = new Date().toISOString();
  const experimentId = id('exp');
  const assignmentSalt = id('salt');
  const canonicalPage = parseJson(page.page_json, {});
  const snapshot = stringifyPage({
    ...canonicalPage,
    id: page.id,
    projectId: page.project_id,
    slug: page.slug || canonicalPage.slug || '',
    title: page.title || canonicalPage.title || '',
    revision: Number(page.revision || canonicalPage.revision || 1),
    updatedAt: page.updated_at || canonicalPage.updatedAt || '',
  });

  const experimentStatement = db.prepare(`
    INSERT INTO page_experiments (
      id, project_id, page_id, name, status, assignment_salt, assignment_version,
      winner_variant_id, started_at, ended_at, created_by_account_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'draft', ?, 1, NULL, NULL, NULL, ?, ?, ?)
  `).bind(
    experimentId,
    safeProjectId,
    safePageId,
    String(name || '').trim(),
    assignmentSalt,
    createdByAccountId || null,
    now,
    now,
  );

  const variantStatements = ['A', 'B'].map((variantKey) => db.prepare(`
    INSERT INTO page_variants (
      id, experiment_id, project_id, page_id, variant_key, name, status,
      traffic_weight, page_json, source_revision_id, source_revision,
      created_by_account_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'active', 50, ?, ?, ?, ?, ?, ?)
  `).bind(
    `${experimentId}_${variantKey.toLowerCase()}`,
    experimentId,
    safeProjectId,
    safePageId,
    variantKey,
    `Variant ${variantKey}`,
    snapshot,
    sourceRevision?.id || null,
    Number(sourceRevision?.revision || page.revision || 0),
    createdByAccountId || null,
    now,
    now,
  ));

  try {
    await runStatements(db, [experimentStatement, ...variantStatements]);
  } catch (error) {
    if (/UNIQUE constraint failed|idx_page_experiments_one_open/i.test(String(error?.message || error))) {
      throw conflict('An open experiment already exists for this page.', 'PAGE_EXPERIMENT_ALREADY_OPEN');
    }
    throw error;
  }

  return getD1PageExperiment(db, {
    projectId: safeProjectId,
    pageId: safePageId,
    experimentId,
  });
}

export async function updateD1PageVariantDraft(db, {
  projectId,
  pageId,
  experimentId,
  variantKey,
  page,
  name,
} = {}) {
  assertD1(db);
  const experiment = await db.prepare(`
    SELECT id, status
    FROM page_experiments
    WHERE id = ? AND project_id = ? AND page_id = ?
    LIMIT 1
  `).bind(String(experimentId || ''), String(projectId || ''), String(pageId || '')).first();
  if (!experiment) {
    const error = new Error('Experiment not found.');
    error.status = 404;
    error.code = 'PAGE_EXPERIMENT_NOT_FOUND';
    throw error;
  }
  if (String(experiment.status || '') !== 'draft') {
    throw conflict('Only draft experiment variants can be edited.', 'PAGE_EXPERIMENT_VARIANT_LOCKED');
  }

  const key = String(variantKey || '').trim().toUpperCase();
  if (!['A', 'B'].includes(key)) {
    const error = new Error('Variant key must be A or B.');
    error.status = 400;
    error.code = 'PAGE_VARIANT_KEY_INVALID';
    throw error;
  }
  const current = await getD1PageVariant(db, { projectId, pageId, experimentId, variantKey: key });
  if (!current) {
    const error = new Error('Variant not found.');
    error.status = 404;
    error.code = 'PAGE_VARIANT_NOT_FOUND';
    throw error;
  }

  const nextPage = page && typeof page === 'object' ? page : current.page;
  const json = stringifyPage({
    ...nextPage,
    id: current.pageId,
    projectId: current.projectId,
  });
  const updatedAt = new Date().toISOString();
  await db.prepare(`
    UPDATE page_variants
    SET page_json = ?, name = ?, updated_at = ?
    WHERE id = ? AND experiment_id = ? AND project_id = ? AND page_id = ?
  `).bind(
    json,
    name === undefined ? current.name : String(name || '').trim(),
    updatedAt,
    current.id,
    current.experimentId,
    current.projectId,
    current.pageId,
  ).run();

  await db.prepare(`
    UPDATE page_experiments
    SET updated_at = ?
    WHERE id = ? AND project_id = ? AND page_id = ?
  `).bind(updatedAt, current.experimentId, current.projectId, current.pageId).run();

  return getD1PageVariant(db, { projectId, pageId, experimentId, variantKey: key });
}

export function pageExperimentIsOpen(status = '') {
  return OPEN_EXPERIMENT_STATUSES.has(String(status || ''));
}

export function pageExperimentIsTerminal(status = '') {
  return TERMINAL_EXPERIMENT_STATUSES.has(String(status || ''));
}

export const PAGE_VARIANT_MAX_BYTES = PAGE_VARIANT_JSON_MAX_BYTES;

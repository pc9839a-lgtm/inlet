const VISITOR_ID_MAX_LENGTH = 128;
const VARIANT_KEY_PATTERN = /^[A-Z0-9_-]{1,16}$/;

function cleanVisitorId(value = '') {
  const raw = String(value || '').trim();
  if (!raw || raw.length > VISITOR_ID_MAX_LENGTH) return '';
  return /^[A-Za-z0-9._:-]+$/.test(raw) ? raw : '';
}

function fnv1a32(value = '') {
  let hash = 0x811c9dc5;
  for (const char of String(value || '')) {
    const code = char.codePointAt(0);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    if (code > 0xff) {
      hash ^= (code >>> 8) & 0xff;
      hash = Math.imul(hash, 0x01000193);
      if (code > 0xffff) {
        hash ^= (code >>> 16) & 0xff;
        hash = Math.imul(hash, 0x01000193);
      }
    }
  }
  return hash >>> 0;
}

export function experimentAssignmentBucket({
  experimentId = '',
  assignmentSalt = '',
  assignmentVersion = 1,
  visitorId = '',
} = {}) {
  const safeVisitorId = cleanVisitorId(visitorId);
  if (!safeVisitorId) return null;
  const seed = [
    String(experimentId || ''),
    String(assignmentSalt || ''),
    Math.max(1, Number(assignmentVersion || 1)),
    safeVisitorId,
  ].join('|');
  return fnv1a32(seed) % 10000;
}

export function selectExperimentVariant({
  experiment = {},
  variants = [],
  visitorId = '',
} = {}) {
  if (String(experiment.status || '') !== 'running') return null;
  const safeVisitorId = cleanVisitorId(visitorId);
  if (!safeVisitorId) return null;

  const active = (Array.isArray(variants) ? variants : [])
    .filter((variant) => String(variant.status || 'active') === 'active')
    .map((variant) => ({
      ...variant,
      key: String(variant.key || variant.variantKey || '').trim().toUpperCase(),
      trafficWeight: Math.max(0, Math.min(100, Math.floor(Number(variant.trafficWeight ?? variant.traffic_weight ?? 0)))),
    }))
    .filter((variant) => VARIANT_KEY_PATTERN.test(variant.key) && variant.trafficWeight > 0)
    .sort((a, b) => a.key.localeCompare(b.key));

  const totalWeight = active.reduce((sum, variant) => sum + variant.trafficWeight, 0);
  if (active.length < 2 || totalWeight !== 100) return null;

  const bucket = experimentAssignmentBucket({
    experimentId: experiment.id,
    assignmentSalt: experiment.assignmentSalt || experiment.assignment_salt,
    assignmentVersion: experiment.assignmentVersion || experiment.assignment_version,
    visitorId: safeVisitorId,
  });
  if (bucket == null) return null;

  const percentile = bucket / 100;
  let cumulative = 0;
  let selected = active[active.length - 1];
  for (const variant of active) {
    cumulative += variant.trafficWeight;
    if (percentile < cumulative) {
      selected = variant;
      break;
    }
  }

  return {
    experimentId: String(experiment.id || ''),
    variantId: String(selected.id || ''),
    variantKey: selected.key,
    assignmentVersion: Math.max(1, Number(experiment.assignmentVersion || experiment.assignment_version || 1)),
    sourceRevision: Math.max(0, Number(selected.sourceRevision || selected.source_revision || 0)),
    bucket,
    page: selected.page && typeof selected.page === 'object' ? selected.page : {},
  };
}

export function publicPageFromExperimentAssignment(canonicalPage = {}, assignment = null) {
  if (!assignment?.variantId || !assignment?.page) return canonicalPage;
  const variantPage = assignment.page && typeof assignment.page === 'object' ? assignment.page : {};
  return {
    ...variantPage,
    id: canonicalPage.id,
    projectId: canonicalPage.projectId,
    ownerId: canonicalPage.ownerId,
    slug: canonicalPage.slug,
    revision: canonicalPage.revision,
    publishedAt: canonicalPage.publishedAt,
    createdAt: canonicalPage.createdAt,
    updatedAt: canonicalPage.updatedAt,
    __experiment: {
      experimentId: assignment.experimentId,
      variantId: assignment.variantId,
      variantKey: assignment.variantKey,
      assignmentVersion: assignment.assignmentVersion,
      sourceRevision: assignment.sourceRevision,
    },
  };
}

export async function resolveRunningPageExperimentAssignment(db, {
  projectId = '',
  pageId = '',
  visitorId = '',
} = {}) {
  const safeVisitorId = cleanVisitorId(visitorId);
  if (!db || typeof db.prepare !== 'function' || !projectId || !pageId || !safeVisitorId) return null;

  let experiment;
  try {
    experiment = await db.prepare(`
      SELECT *
      FROM page_experiments
      WHERE project_id = ? AND page_id = ? AND status = 'running'
      ORDER BY started_at DESC, updated_at DESC, id DESC
      LIMIT 1
    `).bind(String(projectId), String(pageId)).first();
  } catch (error) {
    if (/no such table|page_experiments/i.test(String(error?.message || error))) return null;
    throw error;
  }
  if (!experiment) return null;

  let rows;
  try {
    const result = await db.prepare(`
      SELECT *
      FROM page_variants
      WHERE experiment_id = ?
        AND project_id = ?
        AND page_id = ?
        AND status = 'active'
      ORDER BY variant_key ASC, id ASC
    `).bind(String(experiment.id), String(projectId), String(pageId)).all();
    rows = Array.isArray(result?.results) ? result.results : [];
  } catch (error) {
    if (/no such table|page_variants/i.test(String(error?.message || error))) return null;
    throw error;
  }

  const variants = rows.map((row) => ({
    id: row.id,
    key: row.variant_key,
    status: row.status,
    trafficWeight: row.traffic_weight,
    sourceRevision: row.source_revision,
    page: (() => {
      try {
        return JSON.parse(String(row.page_json || '{}'));
      } catch {
        return {};
      }
    })(),
  }));

  return selectExperimentVariant({
    experiment: {
      id: experiment.id,
      status: experiment.status,
      assignmentSalt: experiment.assignment_salt,
      assignmentVersion: experiment.assignment_version,
    },
    variants,
    visitorId: safeVisitorId,
  });
}

export function sanitizeExperimentVisitorId(value = '') {
  return cleanVisitorId(value);
}

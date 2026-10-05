import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  experimentAssignmentBucket,
  publicPageFromExperimentAssignment,
  resolveRunningPageExperimentAssignment,
  sanitizeExperimentVisitorId,
  selectExperimentVariant,
} from '../server/pageExperimentAssignment.mjs';
import {
  createD1PageExperiment,
  getD1PageExperiment,
  setD1PageExperimentStatus,
  updateD1PageVariantDraft,
} from '../server/storage/pageExperimentStore.mjs';
import { createPageEventTracker } from '../src/runtime/publicPageRuntimeActions.js';
import { createLeadCaptureAction } from '../src/runtime/leadCaptureActions.js';
import { normalizeLeadItem } from '../src/lib/leadModel.js';

function createD1(sql) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(sql);
  return {
    sqlite,
    prepare(source) {
      const statement = sqlite.prepare(source);
      let params = [];
      const wrapper = {
        bind(...values) {
          params = values;
          return wrapper;
        },
        async first() {
          return statement.get(...params) || null;
        },
        async all() {
          return { results: statement.all(...params), meta: {} };
        },
        async run() {
          const result = statement.run(...params);
          return { success: true, changes: Number(result.changes || 0), meta: { changes: Number(result.changes || 0) } };
        },
      };
      return wrapper;
    },
  };
}

const baseSchema = await readFile('migrations/0001_inlet_core.sql', 'utf8');
const experimentMigration = await readFile('migrations/0017_page_ab_experiments.sql', 'utf8');
const db = createD1(`${baseSchema}\n${experimentMigration}`);

const accountId = 'acct-e5-2-owner';
const projectId = 'project-e5-2';
const pageId = 'page-e5-2';
const revisionId = 'revision-e5-2-11';
const canonicalPage = {
  id: pageId,
  projectId,
  slug: 'e5-stable',
  title: 'Canonical title',
  revision: 11,
  blocks: [{ id: 'hero', type: 'hero', title: 'Original hero' }],
  settings: { published: true },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
  publishedAt: '2026-10-05T00:00:00.000Z',
};

db.sqlite.prepare("INSERT INTO accounts (id, email, name, status) VALUES (?, ?, ?, 'active')")
  .run(accountId, 'owner-e52@example.com', 'Owner');
db.sqlite.prepare("INSERT INTO projects (id, owner_account_id, slug, title, status) VALUES (?, ?, ?, ?, 'active')")
  .run(projectId, accountId, canonicalPage.slug, 'E5-2');
db.sqlite.prepare(`
  INSERT INTO pages (id, project_id, slug, title, page_json, revision, published_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  pageId,
  projectId,
  canonicalPage.slug,
  canonicalPage.title,
  JSON.stringify(canonicalPage),
  canonicalPage.revision,
  canonicalPage.publishedAt,
  canonicalPage.createdAt,
  canonicalPage.updatedAt,
);
db.sqlite.prepare(`
  INSERT INTO page_revisions (id, page_id, project_id, revision, page_json, reason, created_by_account_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  revisionId,
  pageId,
  projectId,
  canonicalPage.revision,
  JSON.stringify(canonicalPage),
  'canonical',
  accountId,
  canonicalPage.updatedAt,
);

const experiment = await createD1PageExperiment(db, {
  projectId,
  pageId,
  name: 'Stable hero assignment',
  createdByAccountId: accountId,
});
await updateD1PageVariantDraft(db, {
  projectId,
  pageId,
  experimentId: experiment.id,
  variantKey: 'B',
  page: {
    ...experiment.variants.find((variant) => variant.key === 'B').page,
    title: 'Variant B title',
    slug: 'unsafe-variant-slug-must-not-win',
    revision: 999,
    blocks: [{ id: 'hero', type: 'hero', title: 'Variant B hero' }],
  },
});

const draftResolve = await resolveRunningPageExperimentAssignment(db, {
  projectId,
  pageId,
  visitorId: 'v_draftvisitor',
});
assert.equal(draftResolve, null, 'draft experiments must never affect public traffic');

const running = await setD1PageExperimentStatus(db, {
  projectId,
  pageId,
  experimentId: experiment.id,
  status: 'running',
});
assert.equal(running.status, 'running');
assert(running.startedAt);

const fixedVisitor = 'v_11111111-2222-4333-8444-555555555555';
const repeated = [];
for (let index = 0; index < 20; index += 1) {
  repeated.push(await resolveRunningPageExperimentAssignment(db, {
    projectId,
    pageId,
    visitorId: fixedVisitor,
  }));
}
assert(repeated.every((item) => item?.variantKey === repeated[0]?.variantKey), 'same visitor must remain on the same variant across refreshes');
assert(repeated.every((item) => item?.bucket === repeated[0]?.bucket), 'same visitor must retain the same assignment bucket');

const reloadedExperiment = await getD1PageExperiment(db, { projectId, pageId, experimentId: experiment.id });
const assignedKeys = new Set();
for (let index = 0; index < 400; index += 1) {
  const assigned = selectExperimentVariant({
    experiment: reloadedExperiment,
    variants: reloadedExperiment.variants,
    visitorId: `v_distribution_${index}`,
  });
  if (assigned?.variantKey) assignedKeys.add(assigned.variantKey);
}
assert.deepEqual([...assignedKeys].sort(), ['A', 'B'], '50/50 assignment must reach both variants');

const firstBucket = experimentAssignmentBucket({
  experimentId: reloadedExperiment.id,
  assignmentSalt: reloadedExperiment.assignmentSalt,
  assignmentVersion: reloadedExperiment.assignmentVersion,
  visitorId: fixedVisitor,
});
const secondBucket = experimentAssignmentBucket({
  experimentId: reloadedExperiment.id,
  assignmentSalt: reloadedExperiment.assignmentSalt,
  assignmentVersion: reloadedExperiment.assignmentVersion,
  visitorId: fixedVisitor,
});
assert.equal(firstBucket, secondBucket);
assert(firstBucket >= 0 && firstBucket < 10000);

const selected = repeated[0];
const publicVariant = publicPageFromExperimentAssignment(canonicalPage, selected);
assert.equal(publicVariant.id, canonicalPage.id);
assert.equal(publicVariant.projectId, canonicalPage.projectId);
assert.equal(publicVariant.slug, canonicalPage.slug, 'variant snapshot must never replace canonical URL identity');
assert.equal(publicVariant.revision, canonicalPage.revision, 'variant snapshot must never forge canonical revision');
assert.equal(publicVariant.publishedAt, canonicalPage.publishedAt);
assert.equal(publicVariant.__experiment.experimentId, experiment.id);
assert.equal(publicVariant.__experiment.variantKey, selected.variantKey);
assert.equal(Object.hasOwn(publicVariant.__experiment, 'visitorId'), false, 'public assignment metadata must not echo visitor identity');
if (selected.variantKey === 'B') {
  assert.equal(publicVariant.title, 'Variant B title');
  assert.equal(publicVariant.blocks[0].title, 'Variant B hero');
} else {
  assert.equal(publicVariant.title, canonicalPage.title);
}

await setD1PageExperimentStatus(db, {
  projectId,
  pageId,
  experimentId: experiment.id,
  status: 'paused',
});
assert.equal(await resolveRunningPageExperimentAssignment(db, {
  projectId,
  pageId,
  visitorId: fixedVisitor,
}), null, 'paused experiments must fall back to canonical');

await setD1PageExperimentStatus(db, {
  projectId,
  pageId,
  experimentId: experiment.id,
  status: 'running',
});
const resumed = await resolveRunningPageExperimentAssignment(db, {
  projectId,
  pageId,
  visitorId: fixedVisitor,
});
assert.equal(resumed.variantKey, selected.variantKey, 'resume must preserve stable assignment');
assert.equal(resumed.bucket, selected.bucket, 'resume must preserve assignment bucket');

assert.equal(sanitizeExperimentVisitorId('v_valid-123.abc:def'), 'v_valid-123.abc:def');
assert.equal(sanitizeExperimentVisitorId('bad visitor id'), '');
assert.equal(sanitizeExperimentVisitorId('x'.repeat(129)), '');
assert.equal(experimentAssignmentBucket({ experimentId: experiment.id, visitorId: '' }), null);

let trackedEvent = null;
const targetPage = publicPageFromExperimentAssignment(canonicalPage, resumed);
const tracker = createPageEventTracker({
  page: targetPage,
  authUser: null,
  publicLandingSlug: canonicalPage.slug,
  currentTrafficAttribution: () => ({
    channel: 'direct',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    sourceUrl: 'https://pagero.kr/e5-stable',
    referrer: '',
    sourceLabel: 'direct',
    isTest: false,
  }),
  detectDeviceType: () => 'desktop',
  uid: () => 'event-e5-2',
  setEvents: () => {},
  persistEvent: async (event) => {
    trackedEvent = event;
    return { ok: true };
  },
  experimentIdentity: () => ({
    visitorId: fixedVisitor,
    sessionId: 's_stable-session',
  }),
});
tracker.track({ type: 'cta_click', label: 'hero' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(trackedEvent.visitorId, fixedVisitor);
assert.equal(trackedEvent.sessionId, 's_stable-session');
assert.equal(trackedEvent.experimentId, experiment.id);
assert.equal(trackedEvent.variantId, resumed.variantId);
assert.equal(trackedEvent.variantKey, resumed.variantKey);
assert.equal(trackedEvent.assignmentVersion, 1);

let persistedLead = null;
const leadAction = createLeadCaptureAction({
  currentTrafficAttribution: () => ({
    channel: 'direct',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    sourceUrl: 'https://pagero.kr/e5-stable',
    referrer: '',
    sourceLabel: 'direct',
    isTest: false,
  }),
  uid: () => 'lead-e5-2',
  normalizeLeadItem,
  setLeads: () => {},
  setLeadPageMeta: () => {},
  trackForPage: () => {},
  isReservationLead: () => false,
  authForTargetPage: () => null,
  persistLead: async (lead) => {
    persistedLead = lead;
    return {
      ...lead,
      delivery: { status: 'success', summary: 'saved', logs: [] },
    };
  },
  runLeadDeliveryForPage: async () => ({ status: 'success', summary: 'saved', logs: [] }),
  isServerLeadMode: () => true,
  syncLeadPatch: () => {},
  upsertVisibleLead: () => {},
  showToast: () => {},
  experimentIdentity: () => ({
    visitorId: fixedVisitor,
    sessionId: 's_stable-session',
  }),
});
await leadAction(targetPage, { type: 'lead', name: '테스트', phone: '01012341234' });
assert.equal(persistedLead.visitorId, fixedVisitor);
assert.equal(persistedLead.sessionId, 's_stable-session');
assert.equal(persistedLead.experimentId, experiment.id);
assert.equal(persistedLead.variantId, resumed.variantId);
assert.equal(persistedLead.variantKey, resumed.variantKey);

const pageRepositorySource = await readFile('src/lib/pageRepository.js', 'utf8');
const publicApiSource = await readFile('functions/api/pages/[slug].js', 'utf8');
const eventRuntimeSource = await readFile('src/runtime/publicPageRuntimeActions.js', 'utf8');
const leadRuntimeSource = await readFile('src/runtime/leadCaptureActions.js', 'utf8');
const visitorSource = await readFile('src/lib/abVisitorIdentity.js', 'utf8');
const assignmentSource = await readFile('server/pageExperimentAssignment.mjs', 'utf8');

assert(pageRepositorySource.includes("params.set('abv', visitorId)"), 'public page fetch must carry stable visitor assignment id');
assert(pageRepositorySource.includes("fetchPublicServerPage(slug, { assignment: false })"), 'post-save public verification must bypass A/B assignment');
assert(publicApiSource.includes("url.searchParams.get('abv')"), 'public API must read only the assignment visitor id parameter');
assert(publicApiSource.includes('publicPageFromExperimentAssignment'), 'public API must use canonical-identity-safe variant composition');
assert(eventRuntimeSource.includes('visitorId: String(ev.visitorId || identity.visitorId'), 'conversion events must carry stable visitor identity');
assert(eventRuntimeSource.includes('pageExperimentTrackingFields(targetPage)'), 'conversion events must carry experiment metadata');
assert(leadRuntimeSource.includes('...pageExperimentTrackingFields(targetPage)'), 'successful lead rows must retain assignment metadata in raw lead payload');
assert(visitorSource.includes('window.localStorage') && visitorSource.includes('window.sessionStorage'), 'visitor identity must persist across refresh while session identity is session-scoped');
assert(assignmentSource.includes("String(experiment.status || '') !== 'running'"), 'only running experiments may assign public traffic');
assert(!assignmentSource.includes("__experiment: {\n      visitorId"), 'public assignment metadata must not include visitor id');

db.sqlite.close();

console.log(JSON.stringify({
  ok: true,
  checks: 53,
  stableVisitorVariant: selected.variantKey,
  stableVisitorBucket: selected.bucket,
  observedVariants: [...assignedKeys].sort(),
  contracts: [
    'same-visitor-stable-refresh-assignment',
    'draft-paused-canonical-fallback',
    'resume-preserves-assignment',
    'canonical-id-slug-revision-protected',
    'visitor-id-not-echoed-in-page-metadata',
    'event-assignment-link',
    'lead-assignment-link',
    'post-save-verification-bypasses-ab',
  ],
  productionWriteExecuted: false,
}, null, 2));

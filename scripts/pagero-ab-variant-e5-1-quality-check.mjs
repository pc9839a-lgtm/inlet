import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  createD1PageExperiment,
  getD1OpenPageExperiment,
  getD1PageVariant,
  listD1PageExperiments,
  pageExperimentIsOpen,
  pageExperimentIsTerminal,
  updateD1PageVariantDraft,
} from '../server/storage/pageExperimentStore.mjs';

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

const accountId = 'acct-e5-owner';
const projectId = 'project-e5';
const pageId = 'page-e5';
const revisionId = 'revision-e5-7';
const canonicalPage = {
  id: pageId,
  projectId,
  slug: 'e5-demo',
  title: 'Canonical',
  revision: 7,
  blocks: [{ id: 'hero', type: 'hero', title: 'Original hero' }],
  settings: { published: true },
  updatedAt: '2026-10-05T00:00:00.000Z',
};

db.sqlite.prepare(`
  INSERT INTO accounts (id, email, name, status)
  VALUES (?, ?, ?, 'active')
`).run(accountId, 'owner@example.com', 'Owner');
db.sqlite.prepare(`
  INSERT INTO projects (id, owner_account_id, slug, title, status)
  VALUES (?, ?, ?, ?, 'active')
`).run(projectId, accountId, 'e5-demo', 'E5 demo');
db.sqlite.prepare(`
  INSERT INTO pages (id, project_id, slug, title, page_json, revision, published_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  pageId,
  projectId,
  'e5-demo',
  'Canonical',
  JSON.stringify(canonicalPage),
  7,
  '2026-10-05T00:00:00.000Z',
  '2026-10-01T00:00:00.000Z',
  '2026-10-05T00:00:00.000Z',
);
db.sqlite.prepare(`
  INSERT INTO page_revisions (id, page_id, project_id, revision, page_json, reason, created_by_account_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  revisionId,
  pageId,
  projectId,
  7,
  JSON.stringify(canonicalPage),
  'canonical',
  accountId,
  '2026-10-05T00:00:00.000Z',
);

const beforePage = db.sqlite.prepare('SELECT page_json, revision, updated_at FROM pages WHERE id = ?').get(pageId);
const beforeRevisionCount = Number(db.sqlite.prepare('SELECT COUNT(*) AS count FROM page_revisions WHERE page_id = ?').get(pageId).count);

const experiment = await createD1PageExperiment(db, {
  projectId,
  pageId,
  name: 'Hero copy test',
  createdByAccountId: accountId,
});
assert.equal(experiment.status, 'draft');
assert.equal(experiment.variants.length, 2);
assert.deepEqual(experiment.variants.map((item) => item.key), ['A', 'B']);
assert.deepEqual(experiment.variants.map((item) => item.trafficWeight), [50, 50]);
assert(experiment.assignmentSalt.startsWith('salt_'));
assert.equal(experiment.assignmentVersion, 1);

for (const variant of experiment.variants) {
  assert.equal(variant.sourceRevisionId, revisionId);
  assert.equal(variant.sourceRevision, 7);
  assert.equal(variant.page.blocks[0].title, 'Original hero');
  assert.equal(variant.page.id, pageId);
  assert.equal(variant.page.projectId, projectId);
}

const editedB = await updateD1PageVariantDraft(db, {
  projectId,
  pageId,
  experimentId: experiment.id,
  variantKey: 'b',
  name: 'New hero',
  page: {
    ...experiment.variants[1].page,
    title: 'Variant B',
    blocks: [{ id: 'hero', type: 'hero', title: 'B hero copy' }],
  },
});
assert.equal(editedB.key, 'B');
assert.equal(editedB.name, 'New hero');
assert.equal(editedB.page.title, 'Variant B');
assert.equal(editedB.page.blocks[0].title, 'B hero copy');

const unchangedA = await getD1PageVariant(db, {
  projectId,
  pageId,
  experimentId: experiment.id,
  variantKey: 'A',
});
assert.equal(unchangedA.page.blocks[0].title, 'Original hero');

const afterPage = db.sqlite.prepare('SELECT page_json, revision, updated_at FROM pages WHERE id = ?').get(pageId);
const afterRevisionCount = Number(db.sqlite.prepare('SELECT COUNT(*) AS count FROM page_revisions WHERE page_id = ?').get(pageId).count);
assert.deepEqual(afterPage, beforePage, 'variant editing must not mutate canonical pages');
assert.equal(afterRevisionCount, beforeRevisionCount, 'variant editing must not append canonical page revisions');

const open = await getD1OpenPageExperiment(db, { projectId, pageId });
assert.equal(open.id, experiment.id);
assert.equal(open.variants.length, 2);
assert.equal((await listD1PageExperiments(db, { projectId, pageId })).length, 1);

await assert.rejects(
  () => createD1PageExperiment(db, { projectId, pageId, name: 'Second open test', createdByAccountId: accountId }),
  (error) => error?.code === 'PAGE_EXPERIMENT_ALREADY_OPEN' && error?.status === 409,
);

db.sqlite.prepare("UPDATE page_experiments SET status = 'running' WHERE id = ?").run(experiment.id);
await assert.rejects(
  () => updateD1PageVariantDraft(db, {
    projectId,
    pageId,
    experimentId: experiment.id,
    variantKey: 'B',
    page: editedB.page,
  }),
  (error) => error?.code === 'PAGE_EXPERIMENT_VARIANT_LOCKED' && error?.status === 409,
);

assert(pageExperimentIsOpen('draft'));
assert(pageExperimentIsOpen('running'));
assert(pageExperimentIsOpen('paused'));
assert(!pageExperimentIsOpen('completed'));
assert(pageExperimentIsTerminal('completed'));
assert(pageExperimentIsTerminal('canceled'));

for (const token of [
  'CREATE TABLE IF NOT EXISTS page_experiments',
  'CREATE TABLE IF NOT EXISTS page_variants',
  "status IN ('draft', 'running', 'paused')",
  'idx_page_experiments_one_open',
  'UNIQUE(experiment_id, variant_key)',
  'source_revision_id',
  'source_revision INTEGER',
  'traffic_weight INTEGER',
  'assignment_salt',
  'assignment_version',
]) {
  assert(experimentMigration.includes(token), `E5-1 migration missing contract: ${token}`);
}

const storeSource = await readFile('server/storage/pageExperimentStore.mjs', 'utf8');
assert(storeSource.includes("WHERE status IN ('draft', 'running', 'paused')"), 'store must treat draft/running/paused as the single open experiment');
assert(storeSource.includes("Only draft experiment variants can be edited."), 'running variants must be immutable');
assert(!storeSource.includes('UPDATE pages'), 'variant store must not mutate canonical pages');
assert(!storeSource.includes('INSERT INTO page_revisions'), 'variant store must not append canonical revisions');

db.sqlite.close();

console.log(JSON.stringify({
  ok: true,
  checks: 41,
  experimentId: experiment.id,
  variants: experiment.variants.map((variant) => variant.key),
  canonicalRevisionBefore: beforePage.revision,
  canonicalRevisionAfter: afterPage.revision,
  canonicalRevisionRowsChanged: afterRevisionCount - beforeRevisionCount,
  contracts: [
    'one-open-experiment-per-page',
    'A-B-snapshot-from-canonical',
    'source-revision-lineage',
    'variant-edit-isolated-from-canonical',
    'running-variant-lock',
    '50-50-initial-weights',
  ],
  productionWriteExecuted: false,
}, null, 2));

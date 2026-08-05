import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [workflow, smoke, configGenerator, wrangler, runbook] = await Promise.all([
  readFile(new URL('.github/workflows/calltag-secure-sync-staging.yml', root), 'utf8'),
  readFile(new URL('scripts/calltag-secure-sync-staging-smoke.mjs', root), 'utf8'),
  readFile(new URL('scripts/calltag-secure-sync-staging-config.mjs', root), 'utf8'),
  readFile(new URL('wrangler.jsonc', root), 'utf8'),
  readFile(new URL('docs/CALLTAG_SECURE_SYNC_STAGING_RUNBOOK_KO.md', root), 'utf8'),
]);

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  'production secure sync remains disabled',
  wrangler.includes('"CALLTAG_SECURE_SYNC_ENABLED": "0"')
    && wrangler.includes('"CALLTAG_SYNC_RETENTION_ENABLED": "0"'),
);
check(
  'staging workflow is manual only',
  workflow.includes('workflow_dispatch:')
    && !workflow.includes('pull_request:')
    && !workflow.includes('push:'),
);
check(
  'staging workflow requires protected environment and explicit confirmation',
  workflow.includes('environment: calltag-staging')
    && workflow.includes('CALLTAG_STAGING_ONLY')
    && workflow.includes('Validate explicit staging confirmation'),
);
check(
  'staging workflow uses separate Cloudflare project and D1 inputs',
  workflow.includes('CALLTAG_STAGING_PAGES_PROJECT')
    && workflow.includes('CALLTAG_STAGING_D1_DATABASE_NAME')
    && workflow.includes('CALLTAG_STAGING_D1_DATABASE_ID')
    && workflow.includes('calltag-secure-sync-staging-config.mjs'),
);
check(
  'migration and deployment are independently gated',
  workflow.includes("inputs.apply_migrations == true")
    && workflow.includes("inputs.deploy_staging == true")
    && workflow.includes("inputs.run_smoke == true"),
);
check(
  'staging secrets are uploaded without repository literals',
  workflow.includes('CALLTAG_STAGING_SESSION_SECRET')
    && workflow.includes('CALLTAG_STAGING_DATA_ENCRYPTION_KEY')
    && workflow.includes('CALLTAG_STAGING_DATA_SEARCH_KEY')
    && workflow.includes('pages secret put INLET_SESSION_SECRET')
    && workflow.includes('pages secret put CALLTAG_DATA_ENCRYPTION_KEY')
    && workflow.includes('pages secret put CALLTAG_DATA_SEARCH_KEY'),
);
check(
  'production deployment command is absent',
  !workflow.includes('--project-name inlet')
    && !workflow.includes('--branch main')
    && !workflow.includes('inlet-prod'),
);
check(
  'smoke test blocks known production hosts',
  smoke.includes("'pagero.kr'")
    && smoke.includes("'calltag.pagero.kr'")
    && smoke.includes("'inlet.pages.dev'")
    && smoke.includes('Production host is blocked'),
);
check(
  'smoke test requires two distinct accounts',
  smoke.includes('CALLTAG_STAGING_ACCOUNT_A_EMAIL')
    && smoke.includes('CALLTAG_STAGING_ACCOUNT_B_EMAIL')
    && smoke.includes('Two distinct staging accounts are required')
    && smoke.includes('ownersDistinct: true'),
);
check(
  'same entity ID isolation and reinstall recovery are verified',
  smoke.includes('sameEntityIdIsolated: true')
    && smoke.includes('reinstallBootstrapVerified: true')
    && smoke.includes('Account A leaked account B payload')
    && smoke.includes('Account B leaked account A payload'),
);
check(
  'staging data is cleaned with tombstones',
  smoke.includes("cleanup: 'tombstones-written'")
    && smoke.includes('pushedA')
    && smoke.includes('pushedB')
    && smoke.includes('finally'),
);
check(
  'generated config enables only staging sync',
  configGenerator.includes("CALLTAG_SECURE_SYNC_ENABLED: '1'")
    && configGenerator.includes("CALLTAG_SYNC_RETENTION_ENABLED: '0'")
    && configGenerator.includes("CALLTAG_STAGING_ENVIRONMENT: '1'")
    && configGenerator.includes('productionBindingsIncluded: false'),
);
check(
  'generated config rejects production names',
  configGenerator.includes("projectName.includes('staging')")
    && configGenerator.includes("databaseName.toLowerCase().includes('staging')")
    && configGenerator.includes("databaseName === 'inlet-prod'"),
);

for (const phrase of [
  '운영 환경과 완전히 분리',
  'CALLTAG_STAGING_ONLY',
  'GitHub Environment',
  '두 계정 격리',
  '재설치 복구',
  '운영 flag는 계속 0',
]) {
  check(`runbook contains ${phrase}`, runbook.includes(phrase));
}

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}
if (failed.length) {
  throw new Error(`CallTag staging contract QA failed: ${failed.map(([name]) => name).join(', ')}`);
}
console.log(`CallTag staging contract QA passed: ${checks.length} checks`);

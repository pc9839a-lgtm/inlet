import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const source = readFileSync('.github/workflows/deploy-cloudflare.yml', 'utf8');
const header = source.split(/^concurrency:\s*$/m)[0];
const job = source.split(/^jobs:\s*$/m)[1] || '';

assert.match(header, /^on:\s*\n  workflow_run:\s*\n    workflows: \["QA"\]\s*\n    types: \[completed\]\s*\n    branches: \[main\]/m, 'production deployment must run only after completed main QA');
assert.match(header, /^  workflow_dispatch:/m, 'manual deployment fallback must remain');
assert.doesNotMatch(header, /^  (push|pull_request|schedule):/m, 'production deployment must not listen directly to unverified commits or PRs');
assert.match(header, /expected_sha:\s*\n\s+description:[^\n]+\n\s+required: true/m, 'expected SHA input is mandatory');
assert.match(header, /approval_phrase:\s*\n\s+description:[^\n]+\n\s+required: true/m, 'explicit approval input is mandatory');
assert.match(source, /group: inlet-cloudflare-production\s*\n  cancel-in-progress: false/, 'production deploy cannot cancel active runs');
assert.match(job, /environment: production/, 'production protection environment must be set');
assert.match(job, /github\.ref == 'refs\/heads\/main'/, 'manual deploys are restricted to main');
assert.match(job, /github\.event\.workflow_run\.event == 'push'/, 'automatic deploys require a main push QA run');
assert.match(job, /github\.event\.workflow_run\.head_branch == 'main'/, 'automatic deploys must use main');
assert.match(job, /github\.event\.workflow_run\.conclusion == 'success'/, 'automatic deploys need successful QA');
assert.match(job, /run\.head_repository\?\.full_name !== repository/, 'automatic deploy QA must originate from this repository');
assert.match(job, /run\.head_sha !== sha/, 'automatic deploy must use the completed QA SHA');
assert.match(job, /APPROVAL_PHRASE" != "I_APPROVE_PAGERO_PRODUCTION_DEPLOY"/, 'deployment requires exact approval phrase');
assert.match(job, /APPROVED_SHA" != "\$GITHUB_SHA"/, 'approved SHA must match dispatched SHA');
assert.match(job, /actions\/workflows\/qa\.yml\/runs\?branch=main&head_sha=\$APPROVED_SHA&event=push/, 'exact successful main QA must be checked through GitHub API');
assert.match(job, /run\.conclusion === 'success'/, 'only successful QA may deploy');
assert.match(job, /run\.head_sha === sha/, 'QA must refer to the exact SHA');
assert.match(job, /Recheck current main before uploading production/, 'main movement must abort before upload');
assert.doesNotMatch(job, /--request PATCH/, 'deployment cannot silently change Cloudflare project settings');
assert.match(job, /--commit-hash "\$\{\{ steps\.source\.outputs\.sha \}\}"/, 'Cloudflare deployment must pin verified SHA');
assert.match(job, /Verify PageRo public browser launch smoke/, 'post-deploy real-browser QA must remain');
assert.match(job, /Verify production D1 save roundtrip/, 'post-deploy D1 QA must remain');
assert.match(job, /Verify CallTag external integration CRUD/, 'post-deploy integrations QA must remain');

// A single protected release command is insufficient if another workflow can
// publish the shared Pages project, rotate its secrets, or rewrite main.
// Fail closed on every workflow: this catches newly added deployment triggers,
// not just the historical bypasses retired in DEP-00.
const workflowDir = '.github/workflows';
const workflowNames = readdirSync(workflowDir).filter(name => /\.ya?ml$/.test(name));
const approvedProductionWriter = 'deploy-cloudflare.yml';
const approvedOtherSiteWriters = new Set([
  'restore-life-content-origin.yml',
  'retire-legacy-life-pages.yml',
]);
const approvedManualSecretWriter = 'calltag-admin-cloudflare-bootstrap.yml';
const writers = [
  /\b(?:npx\s+)?wrangler\s+pages\s+deploy\b/i,
  /\bnpm\s+run\s+deploy:pages\b/i,
  /\bscripts\/deploy-pages\.mjs\b/i,
  /\bwrangler\s+pages\s+secret\s+put\b/i,
];
const directMainWrite = /\bgit\s+push[^\n]*(?:HEAD:main|refs\/heads\/main)\b/i;
for (const workflow of workflowNames) {
  const body = readFileSync(`${workflowDir}/${workflow}`, 'utf8');
  if (workflow === approvedProductionWriter) continue;
  if (approvedOtherSiteWriters.has(workflow)) {
    assert.doesNotMatch(body, /--project-name\s+inlet\b/, `${workflow} must not deploy shared inlet`);
    assert.match(body, /--project-name\s+life-pagero\b/, `${workflow} is allowed only for life-pagero`);
  } else if (workflow === approvedManualSecretWriter) {
    assert.match(body, /^on:\s*\n  workflow_dispatch:/m, 'secret bootstrap must be manual-only');
    assert.doesNotMatch(body, /^  (?:push|pull_request|workflow_run|issues|schedule):/m, 'secret bootstrap must not be automatic');
    assert.match(body, /environment: production/, 'secret bootstrap requires production environment');
    assert.match(body, /I_APPROVE_CALLTAG_ADMIN_CLOUDFLARE_BOOTSTRAP/, 'secret bootstrap requires independent approval');
    for (const writer of writers.slice(0, 3)) assert.doesNotMatch(body, writer, `${workflow} must not deploy pages`);
  } else {
    for (const writer of writers) assert.doesNotMatch(body, writer, `unauthorized Cloudflare Pages writer: ${workflow}`);
  }
  assert.doesNotMatch(body, directMainWrite, `automatic main-branch write path is forbidden: ${workflow}`);
}
const otp = readFileSync(`${workflowDir}/calltag-admin-otp-bootstrap.yml`, 'utf8');
assert.match(otp, /^on:\s*\n  workflow_dispatch:/m, 'OTP bootstrap must be manual-only');
assert.doesNotMatch(otp, /^  (?:push|pull_request|workflow_run|issues|schedule):/m, 'OTP bootstrap must not be automatic');
assert.match(otp, /environment: production/, 'OTP bootstrap requires production environment');
assert.match(otp, /I_APPROVE_CALLTAG_ADMIN_OTP_BOOTSTRAP/, 'OTP bootstrap requires independent approval');

console.log(JSON.stringify({ ok: true, name: 'pagero-production-qa-gated-deploy', checks: 23, workflowsInspected: workflowNames.length, productionWrites: false }));

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('.github/workflows/deploy-cloudflare.yml', 'utf8');
const header = source.split(/^concurrency:\s*$/m)[0];
const job = source.split(/^jobs:\s*$/m)[1] || '';

assert.match(header, /^on:\s*\n  workflow_dispatch:\s*\n/m, 'deployment must be manually dispatched');
assert.doesNotMatch(header, /^  (workflow_run|push|pull_request|schedule):/m, 'deployment must never be triggered automatically');
assert.match(header, /expected_sha:\s*\n\s+description:[^\n]+\n\s+required: true/m, 'expected SHA input is mandatory');
assert.match(header, /approval_phrase:\s*\n\s+description:[^\n]+\n\s+required: true/m, 'explicit approval input is mandatory');
assert.match(source, /group: inlet-cloudflare-production\s*\n  cancel-in-progress: false/, 'production deploy cannot cancel active runs');
assert.match(job, /environment: production/, 'production protection environment must be set');
assert.match(job, /github\.ref == 'refs\/heads\/main'/, 'only main may deploy');
assert.match(job, /APPROVAL_PHRASE" != "I_APPROVE_PAGERO_PRODUCTION_DEPLOY"/, 'deployment requires exact approval phrase');
assert.match(job, /APPROVED_SHA" != "\$GITHUB_SHA"/, 'approved SHA must match dispatched SHA');
assert.match(job, /actions\/workflows\/qa\.yml\/runs\?branch=main&head_sha=\$GITHUB_SHA&event=push/, 'exact successful main QA must be checked through GitHub API');
assert.match(job, /run\.conclusion === 'success'/, 'only successful QA may deploy');
assert.match(job, /run\.head_sha === sha/, 'QA must refer to the exact SHA');
assert.match(job, /Recheck current main before uploading production/, 'main movement must abort before upload');
assert.doesNotMatch(job, /--request PATCH/, 'deployment cannot silently change Cloudflare project settings');
assert.match(job, /--commit-hash "\$\{\{ steps\.source\.outputs\.sha \}\}"/, 'Cloudflare deployment must pin verified SHA');
assert.match(job, /Verify PageRo public browser launch smoke/, 'post-deploy real-browser QA must remain');
assert.match(job, /Verify production D1 save roundtrip/, 'post-deploy D1 QA must remain');
assert.match(job, /Verify CallTag external integration CRUD/, 'post-deploy integrations QA must remain');

console.log(JSON.stringify({ ok: true, name: 'pagero-production-explicit-deploy-gate', checks: 18, productionWrites: false }));

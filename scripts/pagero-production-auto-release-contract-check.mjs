import assert from 'node:assert/strict';
import fs from 'node:fs';

const release = fs.readFileSync('.github/workflows/deploy-cloudflare.yml','utf8');
const qa = fs.readFileSync('.github/workflows/qa.yml','utf8');
const checks = [
  ['QA-only completion trigger', /workflow_run:\s*\n\s+workflows: \["QA"\]\s*\n\s+types: \[completed\]\s*\n\s+branches: \[main\]/.test(release)],
  ['Manual fallback preserved', release.includes('workflow_dispatch:') && release.includes('I_APPROVE_PAGERO_PRODUCTION_DEPLOY')],
  ['Only first-party main push QA success may auto deploy', release.includes("github.event.workflow_run.event == 'push'") && release.includes("github.event.workflow_run.head_branch == 'main'") && release.includes("github.event.workflow_run.conclusion == 'success'")],
  ['Auto event body confirms repository provenance', release.includes('run.head_repository?.full_name !== repository') && release.includes('event.repository?.full_name !== repository')],
  ['Required workflow-run name, status, SHA verified', release.includes("run.name !== 'QA'") && release.includes("run.status !== 'completed'") && release.includes('run.head_sha !== sha')],
  ['Production uses exact QA proven SHA', release.includes("github.event.workflow_run.head_sha || inputs.expected_sha") && release.includes('head_sha=$APPROVED_SHA')],
  ['Current main checked before build', release.includes("main?.commit?.sha !== sha")],
  ['Current main checked again before deployment', release.includes('node - /tmp/pagero-main-before-upload.json "\${{ steps.source.outputs.sha }}"')],
  ['Approved SHA used for build and deploy', release.includes('echo "sha=$APPROVED_SHA" >> "$GITHUB_OUTPUT"') && release.includes('echo "sha=\${{ steps.approval.outputs.sha }}"')],
  ['No concurrent overwrites of production deploys', release.includes('group: inlet-cloudflare-production') && release.includes('cancel-in-progress: false')],
  ['Production environment and audited Cloudflare path preserved', release.includes('environment: production') && release.includes('Verify Cloudflare Git auto-deploy is disabled')],
  ['Tests production browser, save roundtrip, and integrations', release.includes('Verify production D1 save roundtrip') && release.includes('Verify CallTag external integration CRUD') && release.includes('PageRo production browser')],
  ['QA runs on main pushes', /push:\s*\n\s+branches:\s*\n\s+- main/.test(qa)],
];
for(const [name,pass] of checks){assert.equal(pass,true,name);console.log('ok - '+name);}
console.log('production auto release contract: '+checks.length+' checks passed');

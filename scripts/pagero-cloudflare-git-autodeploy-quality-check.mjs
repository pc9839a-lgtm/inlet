import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  evaluateRepairGate,
  evaluateSource,
} from './pagero-cloudflare-git-autodeploy-guard.mjs';

const base = { name: 'inlet', production_branch: 'main' };
assert.equal(evaluateSource({ ...base, source: null }).ok, true);
assert.equal(evaluateSource({ ...base, source: { type: 'github', config: { production_branch: 'main', production_deployments_enabled: false } } }).ok, true);
assert.equal(evaluateSource({ ...base, source: { type: 'gitlab', config: { production_deployments_enabled: false } } }).ok, true);
assert.equal(evaluateSource({ ...base, source: { type: 'github', config: { deployments_enabled: false } } }).ok, true);

for (const [label, project] of [
  ['wrong project', { ...base, name: 'another-project' }],
  ['wrong production branch', { ...base, production_branch: 'preview' }],
  ['git autodeploy enabled', { ...base, source: { type: 'github', config: { production_deployments_enabled: true } } }],
  ['git autodeploy unknown', { ...base, source: { type: 'github', config: {} } }],
  ['git source config missing', { ...base, source: { type: 'github' } }],
  ['git source branch mismatch', { ...base, source: { type: 'gitlab', config: { production_branch: 'release', production_deployments_enabled: false } } }],
  ['unknown source', { ...base, source: { type: 'mystery' } }],
]) {
  assert.equal(evaluateSource(project).ok, false, label);
}
assert.equal(evaluateRepairGate({ mode: 'audit' }).ok, true);
assert.equal(evaluateRepairGate({ mode: 'disable', event: 'workflow_dispatch', branch: 'main', approval: 'I_APPROVE_DISABLE_PAGERO_CLOUDFLARE_AUTODEPLOY' }).ok, true);
for (const [label, patch] of [
  ['no approval', { approval: '' }],
  ['wrong approval', { approval: 'wrong' }],
  ['wrong branch', { branch: 'feature' }],
  ['not manual', { event: 'push' }],
]) {
  const gate = evaluateRepairGate({
    mode: 'disable',
    event: 'workflow_dispatch',
    branch: 'main',
    approval: 'I_APPROVE_DISABLE_PAGERO_CLOUDFLARE_AUTODEPLOY',
    ...patch,
  });
  assert.equal(gate.ok, false, label);
}
assert.equal(evaluateRepairGate({ mode: 'delete' }).ok, false);

const [deploy, workflow, src] = await Promise.all([
  readFile('.github/workflows/deploy-cloudflare.yml', 'utf8'),
  readFile('.github/workflows/pagero-cloudflare-autodeploy-safety.yml', 'utf8'),
  readFile('scripts/pagero-cloudflare-git-autodeploy-guard.mjs', 'utf8'),
]);
const cloudflareCheck = 'Verify Cloudflare Git auto-deploy is disabled';
const deployStage = 'Deploy assets and Pages Functions';
assert(deploy.includes(cloudflareCheck) && deploy.indexOf(cloudflareCheck) < deploy.indexOf(deployStage),
  'production deploy must audit Cloudflare automatic Git deployments before upload');
assert(workflow.includes('workflow_dispatch:') && !workflow.includes('schedule:') && !workflow.includes('push:'),
  'Cloudflare settings audit/repair must be strictly manual');
assert(workflow.includes('environment: production'), 'sensitive Cloudflare operations use production Environment');
assert(workflow.includes('I_APPROVE_DISABLE_PAGERO_CLOUDFLARE_AUTODEPLOY'), 'disable has explicit approval');
assert(src.includes("method = 'GET'") && src.includes("mode === 'disable'") && src.includes("production_deployments_enabled: false"),
  'Cloudflare audit is GET-only, and repair only disables Git auto production builds');
assert(src.includes('evaluateSource(await requestCloudflare(url, token))'),
  'post-repair GET must confirm automatic deployment was actually disabled');
assert(!src.includes('process.env.CLOUDFLARE_API_TOKEN || \'static-'),
  'Cloudflare API key must never have a static fallback');

console.log(JSON.stringify({ ok: true, check: 'pagero-cloudflare-auto-deploy-guard', noLiveApiCalls: true }));

// Cloudflare Pages source guard: GET-only in preflight mode, sanitized diagnostics.
// Repair is restricted to an independent manually approved workflow.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_NAME = 'inlet';
const APPROVAL_PHRASE = 'I_APPROVE_DISABLE_PAGERO_CLOUDFLARE_AUTODEPLOY';

export function evaluateSource(result = {}) {
  if (!result || result.name !== PROJECT_NAME) {
    return { ok: false, reason: 'unexpected-pages-project' };
  }
  if (result.production_branch !== 'main') {
    return { ok: false, reason: 'unexpected-production-branch' };
  }
  const source = result.source;
  // Direct Upload projects do not have a Git integration, and cannot
  // automatically deploy from a Git push.
  if (source === null || source === undefined) {
    return { ok: true, reason: 'direct-upload-no-git-source', sourceType: 'none' };
  }
  const type = String(source.type || '').toLowerCase();
  if (type !== 'github' && type !== 'gitlab') {
    return { ok: false, reason: 'unknown-git-source-type', sourceType: type || 'unknown' };
  }
  const config = source.config;
  if (!config || typeof config !== 'object') {
    return { ok: false, reason: 'git-source-config-missing', sourceType: type };
  }
  if (config.production_branch && config.production_branch !== 'main') {
    return { ok: false, reason: 'git-source-branch-mismatch', sourceType: type };
  }
  if (config.production_deployments_enabled === false || (
    config.production_deployments_enabled === undefined &&
    config.deployments_enabled === false
  )) {
    return { ok: true, reason: 'git-production-autodeploy-disabled', sourceType: type };
  }
  if (config.production_deployments_enabled === true || config.deployments_enabled === true) {
    return { ok: false, reason: 'git-production-autodeploy-enabled', sourceType: type };
  }
  return { ok: false, reason: 'git-production-autodeploy-unknown', sourceType: type };
}

export function evaluateRepairGate({ mode = 'audit', event = '', branch = '', approval = '' } = {}) {
  const errors = [];
  if (!['audit', 'disable'].includes(mode)) errors.push('unsupported-mode');
  if (mode === 'disable') {
    if (event !== 'workflow_dispatch') errors.push('manual-dispatch-required');
    if (branch !== 'main') errors.push('main-branch-required');
    if (approval !== APPROVAL_PHRASE) errors.push('explicit-disable-approval-required');
  }
  return { ok: errors.length === 0, errors };
}

async function requestCloudflare(url, token, method = 'GET', body = null) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body === null ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === null ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('cloudflare-invalid-json'); }
  if (!response.ok || parsed?.success !== true || !parsed?.result) {
    throw new Error(`cloudflare-project-request-failed-${response.status}`);
  }
  return parsed.result;
}

async function main() {
  const mode = String(process.env.PAGERO_CLOUDFLARE_AUTODEPLOY_MODE || 'audit').trim();
  const gate = evaluateRepairGate({
    mode,
    event: String(process.env.GITHUB_EVENT_NAME || ''),
    branch: String(process.env.GITHUB_REF_NAME || ''),
    approval: String(process.env.PAGERO_CLOUDFLARE_AUTODEPLOY_APPROVAL || ''),
  });
  if (!gate.ok) throw new Error(gate.errors.join(','));
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !token) throw new Error('cloudflare-credentials-missing');
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${PROJECT_NAME}`;
  const current = await requestCloudflare(url, token);
  const before = evaluateSource(current);
  if (mode === 'disable' && before.reason === 'git-production-autodeploy-enabled') {
    // Cloudflare documents PATCH project.source.config.production_deployments_enabled.
    // Preserve preview branch configuration and do not touch production_branch.
    await requestCloudflare(url, token, 'PATCH', {
      source: { type: current.source.type, config: { production_deployments_enabled: false } },
    });
  } else if (mode === 'disable' && !before.ok) {
    throw new Error(before.reason);
  }
  const after = mode === 'disable' ? evaluateSource(await requestCloudflare(url, token)) : before;
  const report = {
    ok: after.ok,
    scope: 'pagero-cloudflare-pages-git-autodeploy',
    project: PROJECT_NAME,
    mode,
    stateBefore: before.reason,
    stateAfter: after.reason,
    sourceType: after.sourceType || 'unknown',
    productionBranch: 'main',
    secretValuesIncluded: false,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!after.ok) process.exitCode = 1;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invoked === import.meta.url) {
  main().catch((error) => {
    // Never include Cloudflare response bodies, account keys, or request headers in logs.
    console.error(JSON.stringify({
      ok: false,
      scope: 'pagero-cloudflare-pages-git-autodeploy',
      reason: String(error?.message || error).slice(0, 160),
      secretValuesIncluded: false,
    }));
    process.exitCode = 1;
  });
}

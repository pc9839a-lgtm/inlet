import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const steps = [
  ['templates:qa', ['scripts/template-quality-check.mjs']],
  ['ai:qa', ['scripts/ai-quality-check.mjs']],
  ['stats:qa', ['scripts/stats-quality-check.mjs']],
  ['revision:qa', ['scripts/revision-quality-check.mjs']],
  ['auth:qa', ['scripts/auth-quality-check.mjs']],
  ['auth:email:qa', ['scripts/auth-email-quality-check.mjs']],
  ['calllink:auth:qa', ['scripts/calllink-auth-quality-check.mjs']],
  ['server:smoke:auth', ['scripts/server-smoke-auth.mjs']],
  ['server:smoke:leads', ['scripts/server-smoke-leads.mjs']],
  ['server:smoke:events', ['scripts/server-smoke-events.mjs']],
  ['server:smoke:pages', ['scripts/server-smoke-pages.mjs']],
  ['server:smoke:integrations', ['scripts/server-smoke-integrations.mjs']],
  ['page:save:qa', ['scripts/page-save-identity-quality-check.mjs']],
  ['page:draft:qa', ['scripts/page-draft-recovery-quality-check.mjs']],
  ['preview:parity:qa', ['scripts/preview-public-parity-quality-check.mjs']],
  ['bottom:fixed:qa', ['scripts/bottom-fixed-ui-quality-check.mjs']],
  ['root:entry:qa', ['scripts/root-app-entry-quality-check.mjs']],
  ['timer:workflow:qa', ['scripts/timer-settings-workflow-quality-check.mjs']],
  ['topnav:balance:qa', ['scripts/topnav-row-balance-quality-check.mjs']],
  ['browser:landing:contract:qa', ['scripts/landing-browser-regression-contract-check.mjs']],
  ['browser:editor:contract:qa', ['scripts/editor-browser-regression-contract-check.mjs']],
  ['deployment:smoke:contract:qa', ['scripts/deployment-route-smoke-contract-check.mjs']],
  ['conversion:qa', ['scripts/conversion-quality-check.mjs']],
  ['csv:qa', ['scripts/csv-quality-check.mjs']],
  ['runtime:qa', ['scripts/runtime-quality-check.mjs']],
  ['mojibake:qa', ['scripts/mojibake-quality-check.mjs']],
  ['perf:qa', ['scripts/offline-performance-check.mjs']],
  ['integration:mock:qa', ['scripts/mock-integration-quality-check.mjs']],
  ['live:qa', ['scripts/live-readiness-check.mjs']],
  ['api:hosted:qa', ['scripts/hosted-api-quality-check.mjs']],
  ['api:hosted:routes:qa', ['scripts/hosted-api-routes-quality-check.mjs']],
  ['jsonl:qa', ['scripts/jsonl-ops-quality-check.mjs']],
  ['d1:schema:qa', ['scripts/d1-schema-quality-check.mjs']],
  ['d1:adapter:qa', ['scripts/d1-adapter-quality-check.mjs']],
  ['ops:qa', ['scripts/ops-readiness-check.mjs']],
  ['api:functions:qa', ['scripts/pages-functions-quality-check.mjs']],
  ['api:security:qa', ['scripts/api-security-quality-check.mjs']],
  ['rendering:qa', ['scripts/rendering-quality-check.mjs']],
  ['css:qa', ['scripts/css-quality-check.mjs']],
  ['build', ['scripts/build.mjs']],
  ['bundle:qa', ['scripts/bundle-quality-check.mjs']],
  ['build:deploy', ['scripts/build-deploy-artifact.mjs']],
  ['accessibility:qa', ['scripts/accessibility-quality-check.mjs']],
  ['artifact:qa', ['scripts/artifact-quality-check.mjs']],
  ['worker3:qa', ['scripts/worker3-quality-check.mjs']],
  ['integration:qa', ['scripts/integration-contract-check.mjs']],
];

function runStep(label, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n[qa:all] ${label}`);
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

function isGeneratedArtifactName(name) {
  return name.startsWith('dist-check-') || name.startsWith('.tmp-') || name.startsWith('inlet-deploy-artifact-') || name === 'preview.zip';
}

function assertSafeArtifactPath(target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`refusing to clean artifact outside workspace: ${target}`);
  }
}

async function cleanGeneratedArtifacts(reason) {
  const entries = await readdir(root, { withFileTypes: true });
  const targets = entries.filter((entry) => isGeneratedArtifactName(entry.name)).map((entry) => path.join(root, entry.name));

  for (const target of targets) {
    assertSafeArtifactPath(target);
    await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }

  if (targets.length) {
    console.log(`[qa:all] cleaned ${targets.length} generated artifact(s) before ${reason}`);
  }
}

await cleanGeneratedArtifacts('start');

for (const [label, args] of steps) {
  if (label === 'artifact:qa' || label === 'worker3:qa' || label === 'integration:qa') {
    await cleanGeneratedArtifacts(label);
  }
  await runStep(label, args);
}

await cleanGeneratedArtifacts('finish');

console.log(JSON.stringify({ ok: true, steps: steps.length }, null, 2));

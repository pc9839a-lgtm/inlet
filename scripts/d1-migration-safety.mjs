import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const runner = path.join(root, 'scripts', 'd1-migration-safety-runner.mjs');
const baselineAudit = path.join(root, 'scripts', 'd1-baseline-audit.mjs');
const baselineWriter = path.join(root, 'scripts', 'd1-baseline-history-write.mjs');
const BASELINE_APPROVAL = 'I_APPROVE_D1_BASELINE_0001_0009';

function run(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(Number(code ?? 1)));
  });
}

async function main() {
  const runnerCode = await run(runner);
  if (runnerCode !== 0) {
    process.exitCode = runnerCode;
    return;
  }

  const mode = String(process.env.INLET_D1_MIGRATION_MODE || 'preflight').trim();
  if (mode !== 'preflight') {
    process.exitCode = 0;
    return;
  }

  const auditCode = await run(baselineAudit);
  if (auditCode !== 0) {
    process.exitCode = auditCode;
    return;
  }

  const writeEnabled = process.env.INLET_D1_MIGRATION_WRITE === '1';
  const approval = String(process.env.INLET_D1_MIGRATION_APPROVAL || '');
  if (!writeEnabled) {
    process.exitCode = 0;
    return;
  }

  if (approval !== BASELINE_APPROVAL) {
    console.error(JSON.stringify({
      ok: false,
      status: 'baseline-history-write-not-approved',
      error: `preflight write requires approval phrase ${BASELINE_APPROVAL}`,
      secretValuesIncluded: false,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const writeCode = await run(baselineWriter);
  process.exitCode = writeCode;
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    status: 'failed-live',
    error: String(error?.message || error).slice(0, 1000),
    secretValuesIncluded: false,
  }, null, 2));
  process.exitCode = 1;
});

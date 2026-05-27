import { spawn } from 'node:child_process';

const checks = [
  ['css:qa', ['scripts/css-quality-check.mjs']],
  ['bundle:qa', ['scripts/bundle-quality-check.mjs']],
  ['rendering:qa', ['scripts/rendering-quality-check.mjs']],
  ['browser:visual:qa', ['scripts/browser-visual-quality-check.mjs']],
  ['stats:qa', ['scripts/stats-quality-check.mjs']],
  ['conversion:qa', ['scripts/conversion-quality-check.mjs']],
  ['live:qa', ['scripts/live-readiness-check.mjs']],
  ['csv:qa', ['scripts/csv-quality-check.mjs']],
  ['runtime:qa', ['scripts/runtime-quality-check.mjs']],
  ['mojibake:qa', ['scripts/mojibake-quality-check.mjs']],
  ['accessibility:qa', ['scripts/accessibility-quality-check.mjs']],
  ['artifact:qa', ['scripts/artifact-quality-check.mjs', '--strict']],
];

function runNode(label, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

for (const [label, args] of checks) {
  console.log(`\n[worker3] ${label}`);
  await runNode(label, args);
}

console.log(JSON.stringify({ ok: true, checks: checks.length }, null, 2));

import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const accessPreflight = path.join(root, 'scripts', 'd1-cloudflare-access-preflight.mjs');
const runner = path.join(root, 'scripts', 'd1-migration-safety-runner.mjs');

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      console.error(JSON.stringify({
        ok: false,
        status: 'failed-live',
        stage: path.basename(script),
        error: String(error?.message || error).slice(0, 1000),
        secretValuesIncluded: false,
      }, null, 2));
      resolve(1);
    });

    child.on('exit', (code) => resolve(Number(code ?? 1)));
  });
}

const accessCode = await runScript(accessPreflight);
if (accessCode !== 0) {
  process.exitCode = accessCode;
} else {
  process.exitCode = await runScript(runner);
}

import { spawn } from 'node:child_process';
import path from 'node:path';

const runner = path.join(process.cwd(), 'scripts', 'd1-migration-safety-runner.mjs');
const child = spawn(process.execPath, [runner], {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(JSON.stringify({
    ok: false,
    status: 'failed-live',
    error: String(error?.message || error).slice(0, 1000),
    secretValuesIncluded: false,
  }, null, 2));
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = Number(code ?? 1);
});

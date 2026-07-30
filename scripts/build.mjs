import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const viteCli = path.resolve(root, 'node_modules/vite/bin/vite.js');
const defaultDist = path.resolve(root, 'dist');

function readArgValue(names) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    for (const name of names) {
      if (arg === name) return args[i + 1] || '';
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return '';
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: 'inherit', cwd: root });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.basename(command)} ${commandArgs.join(' ')} failed with ${signal || code}`));
    });
  });
}

function assertSafeOutputDir(target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`refusing to clean unsafe build output directory: ${target}`);
  }
  if (relative === 'dist') return;
  const normalized = relative.replaceAll(path.sep, '/');
  if (!/^dist(?:-|$)/.test(normalized) && !/^inlet-deploy-artifact-\d+$/.test(normalized)) {
    throw new Error(`build output directory must be dist, dist-*, or inlet-deploy-artifact-* scoped: ${target}`);
  }
}

const outDirArg = readArgValue(['--outDir', '--out-dir']);
const outDir = path.resolve(root, outDirArg || 'dist');
const buildsDefaultDist = outDir === defaultDist;

if (buildsDefaultDist) {
  await run(process.execPath, ['scripts/clean-dist.mjs']);
} else {
  assertSafeOutputDir(outDir);
  await rm(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}

await run(process.execPath, [viteCli, 'build', '--emptyOutDir', 'false', ...args]);

await run(process.execPath, ['scripts/bundle-quality-check.mjs', '--outDir', outDir]);
await run(process.execPath, ['scripts/root-app-entry-quality-check.mjs', '--outDir', outDir]);

if (buildsDefaultDist) {
  await run(process.execPath, ['scripts/prune-dist-assets.mjs']);
}

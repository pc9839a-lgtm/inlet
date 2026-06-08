import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const artifactDirName = `inlet-deploy-artifact-${Date.now()}`;
const artifactDir = path.resolve(root, artifactDirName);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: options.stdio || 'inherit',
      shell: false,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} ${args.join(' ')} failed with ${signal || code}`));
    });
  });
}

await run(process.execPath, ['scripts/build.mjs', '--outDir', artifactDirName]);
await run(process.execPath, ['scripts/deployment-artifact-check.mjs'], {
  env: { INLET_DEPLOY_QA_DIR: artifactDir },
});

console.log(JSON.stringify({
  ok: true,
  artifactDir: artifactDir.replaceAll(path.sep, '/'),
}, null, 2));

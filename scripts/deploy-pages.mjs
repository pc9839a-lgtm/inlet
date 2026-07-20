import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const branchInput = String(process.argv[2] || 'main').trim();
const branch = branchInput === 'staging' ? 'staging' : 'main';
const artifactDirName = `inlet-deploy-artifact-${Date.now()}`;
const artifactDir = path.resolve(root, artifactDirName);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: options.shell === true,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with ${signal || code}`));
    });
  });
}

await run(process.execPath, ['scripts/build.mjs', '--outDir', artifactDirName], { shell: false });
await run(process.execPath, ['scripts/deployment-artifact-check.mjs'], {
  shell: false,
  env: { INLET_DEPLOY_QA_DIR: artifactDir },
});
const wranglerCli = path.resolve(root, 'node_modules/wrangler/bin/wrangler.js');
await run(process.execPath, [wranglerCli, 'pages', 'deploy', artifactDir, '--project-name', 'inlet', '--branch', branch]);

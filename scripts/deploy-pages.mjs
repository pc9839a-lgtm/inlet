import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const branchInput = String(process.argv[2] || 'main').trim();
const branch = branchInput === 'staging' ? 'staging' : 'main';
const artifactDirName = `inlet-deploy-artifact-${Date.now()}`;
const artifactDir = path.resolve(root, artifactDirName);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const capture = options.capture === true;
    const child = spawn(command, args, {
      cwd: root,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: options.shell === true,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    });
    let output = '';
    if (capture) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        output += text;
        process.stderr.write(text);
      });
    }
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(' ')} failed with ${signal || code}`));
    });
  });
}

function stripAnsi(value) {
  return String(value || '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function deploymentUrlFromOutput(output) {
  const clean = stripAnsi(output);
  const matches = [...clean.matchAll(/https:\/\/[a-z0-9.-]+\.pages\.dev\/?/gi)].map((match) => match[0]);
  return matches.at(-1) || '';
}

await run(process.execPath, ['scripts/build.mjs', '--outDir', artifactDirName], { shell: false });
await run(process.execPath, ['scripts/deployment-artifact-check.mjs'], {
  shell: false,
  env: { INLET_DEPLOY_QA_DIR: artifactDir },
});
const wranglerCli = path.resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const deployOutput = await run(process.execPath, [wranglerCli, 'pages', 'deploy', artifactDir, '--project-name', 'inlet', '--branch', branch], { capture: true });
const deploymentUrl = deploymentUrlFromOutput(deployOutput);
if (!deploymentUrl) {
  throw new Error('Cloudflare deployment completed without a detectable pages.dev URL; live asset verification did not run');
}
await run(process.execPath, ['scripts/deployment-live-asset-check.mjs', deploymentUrl], { shell: false });
if (branch === 'main') {
  await run(process.execPath, ['scripts/calltag-push-readiness-check.mjs', deploymentUrl], { shell: false });
}

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const args = process.argv.slice(2);
const strict = !args.includes('--no-strict') && process.env.INLET_ARTIFACT_QA_STRICT !== '0';
const root = process.cwd();
const entries = await readdir(root, { withFileTypes: true });
const candidates = [];

for (const entry of entries) {
  const name = entry.name;
  if (name.startsWith('dist-check-') || name.startsWith('.tmp-') || name.startsWith('inlet-deploy-artifact-') || name === 'preview.zip') {
    const target = path.join(root, name);
    const info = await stat(target);
    candidates.push({
      name,
      type: entry.isDirectory() ? 'directory' : 'file',
      bytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    });
  }
}

const staleDistChecks = candidates.filter((item) => item.name.startsWith('dist-check-'));
const tmpArtifacts = candidates.filter((item) => item.name.startsWith('.tmp-'));
const deployArtifacts = candidates.filter((item) => item.name.startsWith('inlet-deploy-artifact-'));
const previewZip = candidates.find((item) => item.name === 'preview.zip');
const warnings = [
  ...staleDistChecks.map((item) => `stale build output: ${item.name}`),
  ...tmpArtifacts.map((item) => `temporary artifact: ${item.name}`),
  ...deployArtifacts.map((item) => `deployment QA artifact: ${item.name}`),
  ...(previewZip ? [`unexpected archive: ${previewZip.name}`] : []),
];

if (strict) {
  assert(!warnings.length, `artifact cleanup required: ${warnings.join(', ')}`);
}

console.log(JSON.stringify({
  ok: true,
  strict,
  warnings,
  artifacts: candidates,
}, null, 2));

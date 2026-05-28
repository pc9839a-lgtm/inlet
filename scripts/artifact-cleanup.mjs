import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');

function isGeneratedArtifactName(name) {
  return name.startsWith('dist-check-')
    || name.startsWith('.tmp-')
    || name.startsWith('inlet-deploy-artifact-')
    || name === 'preview.zip';
}

function assertSafeArtifactPath(target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`refusing to clean artifact outside workspace: ${target}`);
  }
}

const entries = await readdir(root, { withFileTypes: true });
const artifacts = entries
  .filter((entry) => isGeneratedArtifactName(entry.name))
  .map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? 'directory' : 'file',
    path: path.join(root, entry.name),
  }));

for (const artifact of artifacts) {
  assertSafeArtifactPath(artifact.path);
  if (!dryRun) {
    await rm(artifact.path, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  cleaned: dryRun ? 0 : artifacts.length,
  artifacts: artifacts.map(({ name, type }) => ({ name, type })),
}, null, 2));

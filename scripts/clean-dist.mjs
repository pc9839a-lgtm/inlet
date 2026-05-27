import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const target = path.resolve(root, 'dist');

function isInsideRoot(file) {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function removeWithRetry(file, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(file, { recursive: true, force: true, maxRetries: 2, retryDelay: 120 });
      return true;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 180));
    }
  }
  return false;
}

async function removeChildren(file) {
  const entries = await readdir(file, { withFileTypes: true });
  const failures = [];

  for (const entry of entries) {
    const child = path.join(file, entry.name);
    try {
      await removeWithRetry(child);
    } catch (error) {
      failures.push({ file: child, error });
    }
  }

  return failures;
}

if (!isInsideRoot(target)) {
  throw new Error(`Refusing to clean unsafe path: ${target}`);
}

if (await exists(target)) {
  try {
    await removeWithRetry(target);
    console.log('clean-dist: removed dist');
  } catch (error) {
    console.log(`clean-dist: full cleanup deferred (${error.code || error.message}); removing unlocked children`);
    const failures = await removeChildren(target);

    if (failures.length) {
      console.log(`clean-dist: ${failures.length} locked item(s) remain; postbuild prune will retry stale assets`);
      for (const failure of failures.slice(0, 5)) {
        console.log(`clean-dist: locked ${path.relative(root, failure.file)} (${failure.error.code || failure.error.message})`);
      }
    } else {
      console.log('clean-dist: removed dist contents');
    }
  }
} else {
  console.log('clean-dist: dist not found');
}

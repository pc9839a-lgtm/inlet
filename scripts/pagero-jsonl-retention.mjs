import assert from 'node:assert/strict';
import { lstat, readdir, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DELETES = 50;
const WRITE_PHRASE = 'I_APPROVE_PAGERO_JSONL_RETENTION';
const POLICIES = Object.freeze([
  { directory: '.backups', ageDays: 30, keepNewest: 2, suffix: '.bak' },
  { directory: '.quarantine', ageDays: 14, keepNewest: 1, suffix: '-invalid.jsonl' },
]);

function managedFileName(name, policy) {
  if (!/^(leads|events)\.jsonl\./.test(name)) return false;
  // Only files created by backupJsonlFile/quarantineJsonlLines, not arbitrary files.
  if (!/^(leads|events)\.jsonl\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\./.test(name)) return false;
  return name.endsWith(policy.suffix);
}

async function directoryIfSafe(parent, name) {
  const dir = path.join(parent, name);
  let info;
  try { info = await lstat(dir); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  // A directory symlink could escape the configured data root.
  if (info.isSymbolicLink() || !info.isDirectory()) return null;
  return dir;
}

async function scopedDirectories(dataDir) {
  const roots = [dataDir];
  const projects = await directoryIfSafe(dataDir, 'projects');
  if (!projects) return roots;
  for (const entry of await readdir(projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = await directoryIfSafe(projects, entry.name);
    if (dir) roots.push(dir);
  }
  return roots;
}

function fingerprint(info) {
  return { dev: info.dev, ino: info.ino, size: info.size, mtimeMs: info.mtimeMs };
}

function sameFingerprint(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

function groupKey(name) {
  return name.startsWith('leads.jsonl.') ? 'leads.jsonl' : 'events.jsonl';
}

export async function planJsonlRetention({ dataDir, now = Date.now() } = {}) {
  if (typeof dataDir !== 'string' || !dataDir.trim()) throw new Error('explicit dataDir required');
  if (!Number.isFinite(now)) throw new Error('invalid retention now');
  const root = path.resolve(dataDir);
  let rootInfo;
  try { rootInfo = await lstat(root); }
  catch (error) {
    if (error?.code === 'ENOENT') return { dataDir: root, now, inspected: 0, protected: 0, candidates: [] };
    throw error;
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('data root must be a real directory');
  const candidates = [];
  let inspected = 0;
  let protectedCount = 0;
  for (const projectDir of await scopedDirectories(root)) {
    for (const policy of POLICIES) {
      const dir = await directoryIfSafe(projectDir, policy.directory);
      if (!dir) continue;
      const groups = new Map();
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !managedFileName(entry.name, policy)) continue;
        const file = path.join(dir, entry.name);
        const info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink()) continue;
        const name = groupKey(entry.name);
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push({ file, relativePath: path.relative(root, file), mtimeMs: info.mtimeMs, identity: fingerprint(info), policy });
        inspected++;
      }
      for (const files of groups.values()) {
        files.sort((a, b) => b.mtimeMs - a.mtimeMs || b.relativePath.localeCompare(a.relativePath));
        protectedCount += Math.min(files.length, policy.keepNewest);
        for (const item of files.slice(policy.keepNewest)) {
          if (item.mtimeMs >= now - policy.ageDays * DAY_MS) continue;
          candidates.push({ ...item, ageDays: Math.floor((now - item.mtimeMs) / DAY_MS) });
        }
      }
    }
  }
  candidates.sort((a, b) => a.mtimeMs - b.mtimeMs || a.relativePath.localeCompare(b.relativePath));
  return { dataDir: root, now, inspected, protected: protectedCount, candidates };
}

function assertWriteGate({ dataDir, env, execute }) {
  if (!execute) return;
  if (env.PAGERO_JSONL_RETENTION_WRITE !== '1' || env.PAGERO_JSONL_RETENTION_APPROVAL !== WRITE_PHRASE) {
    throw new Error('JSONL file deletion requires explicit write flag and approval phrase');
  }
  const allowed = String(env.PAGERO_JSONL_RETENTION_ALLOWED_ROOT || '').trim();
  if (!allowed || !path.isAbsolute(allowed) || path.resolve(allowed) === path.parse(allowed).root) {
    throw new Error('write requires a specific absolute allowed data directory');
  }
  if (path.resolve(allowed) !== path.resolve(dataDir)) throw new Error('allowed data root mismatch');
}

export async function runJsonlRetention({ dataDir, now = Date.now(), execute = false, env = process.env, maxDeletes = MAX_DELETES } = {}) {
  if (!Number.isInteger(maxDeletes) || maxDeletes < 1 || maxDeletes > MAX_DELETES) throw new Error('invalid maximum delete count');
  assertWriteGate({ dataDir, env, execute }); // fail closed before examining any private file
  const plan = await planJsonlRetention({ dataDir, now });
  const result = { dryRun: !execute, inspected: plan.inspected, protected: plan.protected, expired: plan.candidates.length, deleteLimit: maxDeletes, deleted: 0, skippedChanged: 0, candidates: plan.candidates.map(x => x.relativePath) };
  if (!execute) return result;
  // The explicit allowlisted path must not resolve through a symlink.
  if (await realpath(plan.dataDir) !== plan.dataDir) throw new Error('data root symlink is forbidden for deletion');
  for (const candidate of plan.candidates.slice(0, maxDeletes)) {
    const dir = path.dirname(candidate.file);
    const project = path.dirname(dir);
    const policyDir = path.basename(dir);
    if (!(await directoryIfSafe(project, policyDir))) { result.skippedChanged++; continue; }
    let current;
    try { current = await lstat(candidate.file); }
    catch (error) {
      if (error?.code === 'ENOENT') { result.skippedChanged++; continue; }
      throw error;
    }
    if (!current.isFile() || !sameFingerprint(fingerprint(current), candidate.identity)) {
      result.skippedChanged++;
      continue;
    }
    assert(path.relative(plan.dataDir, candidate.file) && !path.relative(plan.dataDir, candidate.file).startsWith('..'), 'refuse deletion outside root');
    await unlink(candidate.file);
    result.deleted++;
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  let dataDir = path.resolve(process.cwd(), process.env.INLET_DATA_DIR || 'server/data');
  let execute = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data-dir' && args[i + 1]) dataDir = path.resolve(args[++i]);
    else if (args[i] === '--execute') execute = true;
    else throw new Error('Unknown argument. Supported: --data-dir ABSOLUTE_PATH and --execute');
  }
  const result = await runJsonlRetention({ dataDir, execute });
  console.log(JSON.stringify({ ...result, dataDir, writeApproved: execute }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(String(error?.message || error)); process.exitCode = 1; });
}

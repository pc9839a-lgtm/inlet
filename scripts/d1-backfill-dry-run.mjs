import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, process.env.INLET_DATA_DIR || 'server/data');

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function readJsonl(file) {
  const result = {
    file,
    exists: false,
    rows: [],
    invalid: 0,
  };
  try {
    const info = await stat(file);
    if (!info.isFile()) return result;
    result.exists = true;
  } catch {
    return result;
  }
  const raw = await readFile(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = safeJsonParse(line);
    if (item && typeof item === 'object') result.rows.push(item);
    else result.invalid += 1;
  }
  return result;
}

async function readJson(file, fallback = null) {
  try {
    return safeJsonParse(await readFile(file, 'utf8'), fallback);
  } catch {
    return fallback;
  }
}

async function listProjectDirs() {
  const projectsRoot = path.join(dataDir, 'projects');
  try {
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => ({
      projectId: entry.name,
      dir: path.join(projectsRoot, entry.name),
    }));
  } catch {
    return [];
  }
}

function contactKey(lead = {}) {
  const phone = String(lead.phone || lead.values?.phone || '').replace(/\D/g, '');
  const email = String(lead.email || lead.values?.email || '').trim().toLowerCase();
  return phone || email || '';
}

function createdMonth(item = {}) {
  const raw = String(item.createdAt || item.savedAt || item.created_at || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : 'unknown';
}

function duplicateReport(rows = [], keyFn) {
  const seen = new Map();
  const duplicates = [];
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (seen.has(key)) duplicates.push({ key, firstId: seen.get(key), duplicateId: row.id || '' });
    else seen.set(key, row.id || '');
  }
  return { unique: seen.size, duplicates };
}

function deliveryLogCount(leads = []) {
  return leads.reduce((sum, lead) => sum + (Array.isArray(lead.delivery?.logs) ? lead.delivery.logs.length : 0), 0);
}

function summarizeProject(projectId, files) {
  const leads = files.leads.rows;
  const events = files.events.rows;
  const leadIds = duplicateReport(leads, (lead) => String(lead.id || '').trim());
  const eventIds = duplicateReport(events, (event) => String(event.id || '').trim());
  const contacts = duplicateReport(leads, (lead) => {
    const key = contactKey(lead);
    return key ? `${createdMonth(lead)}:${key}` : '';
  });
  const eventDedupe = duplicateReport(events, (event) => {
    const key = String(event.dedupeKey || event.dedupe_key || '').trim();
    return key ? `${createdMonth(event)}:${key}` : '';
  });
  return {
    projectId,
    files: {
      leads: files.leads.exists,
      events: files.events.exists,
      pageCount: files.pages.length,
    },
    counts: {
      leads: leads.length,
      events: events.length,
      pages: files.pages.length,
      deliveryLogs: deliveryLogCount(leads),
      invalidLeadLines: files.leads.invalid,
      invalidEventLines: files.events.invalid,
    },
    duplicates: {
      leadIds: leadIds.duplicates.slice(0, 20),
      eventIds: eventIds.duplicates.slice(0, 20),
      monthlyContacts: contacts.duplicates.slice(0, 20),
      monthlyEventDedupeKeys: eventDedupe.duplicates.slice(0, 20),
    },
    d1Plan: {
      leads: leads.length,
      events: events.length,
      pages: files.pages.length,
      deliveryLogs: deliveryLogCount(leads),
      skippedInvalidLines: files.leads.invalid + files.events.invalid,
      dryRunOnly: true,
    },
  };
}

async function loadProject(project) {
  const pagesDir = path.join(project.dir, 'pages');
  let pages = [];
  try {
    const entries = await readdir(pagesDir, { withFileTypes: true });
    pages = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
  } catch {
    pages = [];
  }
  return summarizeProject(project.projectId, {
    leads: await readJsonl(path.join(project.dir, 'leads.jsonl')),
    events: await readJsonl(path.join(project.dir, 'events.jsonl')),
    pages,
  });
}

const singletonLeads = await readJsonl(path.join(dataDir, 'leads.jsonl'));
const singletonEvents = await readJsonl(path.join(dataDir, 'events.jsonl'));
const projects = await Promise.all((await listProjectDirs()).map(loadProject));
const users = await readJsonl(path.join(dataDir, 'users.jsonl'));
const emailVerifications = await readJsonl(path.join(dataDir, 'email-verifications.jsonl'));
const legacyPages = await (async () => {
  try {
    const entries = await readdir(path.join(dataDir, 'pages'), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).length;
  } catch {
    return 0;
  }
})();
const aiDrafts = await readJson(path.join(dataDir, 'ai-drafts.json'), []);

const singleton = summarizeProject('singleton', {
  leads: singletonLeads,
  events: singletonEvents,
  pages: Array.from({ length: legacyPages }, (_, index) => ({ name: `legacy-${index}` })),
});

const totals = [singleton, ...projects].reduce((acc, project) => {
  acc.projects += project.projectId === 'singleton' ? 0 : 1;
  acc.leads += project.counts.leads;
  acc.events += project.counts.events;
  acc.pages += project.counts.pages;
  acc.deliveryLogs += project.counts.deliveryLogs;
  acc.invalidLines += project.counts.invalidLeadLines + project.counts.invalidEventLines;
  acc.duplicateLeadIds += project.duplicates.leadIds.length;
  acc.duplicateEventIds += project.duplicates.eventIds.length;
  acc.duplicateMonthlyContacts += project.duplicates.monthlyContacts.length;
  acc.duplicateMonthlyEventDedupeKeys += project.duplicates.monthlyEventDedupeKeys.length;
  return acc;
}, {
  projects: 0,
  leads: 0,
  events: 0,
  pages: 0,
  deliveryLogs: 0,
  invalidLines: 0,
  duplicateLeadIds: 0,
  duplicateEventIds: 0,
  duplicateMonthlyContacts: 0,
  duplicateMonthlyEventDedupeKeys: 0,
});

console.log(JSON.stringify({
  ok: true,
  dryRun: true,
  dataDir,
  totals,
  accounts: {
    users: users.rows.length,
    invalidUserLines: users.invalid,
    emailVerifications: emailVerifications.rows.length,
    invalidEmailVerificationLines: emailVerifications.invalid,
  },
  aiDrafts: Array.isArray(aiDrafts) ? aiDrafts.length : 0,
  singleton,
  projects,
  nextCommand: 'After reviewing this dry-run, run the future D1 write backfill with explicit confirmation only.',
}, null, 2));

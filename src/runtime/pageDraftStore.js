import { PAGE_DRAFTS_KEY } from '../config/storageKeys.js';
import { normalizePageForSave } from '../lib/pageModel.js';

const DRAFT_VERSION = 1;
const MAX_DRAFTS = 12;
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SENSITIVE_KEY = /(api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|password|secret|credential)/i;

function safeStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage || null;
}

function text(value) {
  return String(value || '').trim();
}

function readEnvelope(storage) {
  const target = safeStorage(storage);
  if (!target) return { version: DRAFT_VERSION, drafts: {} };
  try {
    const parsed = JSON.parse(target.getItem(PAGE_DRAFTS_KEY) || '{}');
    return {
      version: DRAFT_VERSION,
      drafts: parsed && typeof parsed.drafts === 'object' && parsed.drafts ? parsed.drafts : {},
    };
  } catch {
    return { version: DRAFT_VERSION, drafts: {} };
  }
}

function writeEnvelope(envelope, storage) {
  const target = safeStorage(storage);
  if (!target) return false;
  try {
    target.setItem(PAGE_DRAFTS_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

function sanitizeValue(value, seen = new WeakSet()) {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object' || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, seen)).filter((item) => item !== undefined);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEY.test(key))
      .map(([key, item]) => [key, sanitizeValue(item, seen)])
      .filter(([, item]) => item !== undefined),
  );
}

function mergeDraftValue(serverValue, draftValue) {
  if (Array.isArray(draftValue)) return draftValue.map((item) => mergeDraftValue(undefined, item));
  if (!draftValue || typeof draftValue !== 'object') return draftValue;
  const serverObject = serverValue && typeof serverValue === 'object' && !Array.isArray(serverValue) ? serverValue : {};
  const keys = [...new Set([...Object.keys(serverObject), ...Object.keys(draftValue)])];
  return Object.fromEntries(keys.map((key) => [
    key,
    Object.prototype.hasOwnProperty.call(draftValue, key)
      ? mergeDraftValue(serverObject[key], draftValue[key])
      : serverObject[key],
  ]));
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameDraftPage(left = {}, right = {}) {
  const leftId = text(left.id || left.pageId || left.slug);
  const rightId = text(right.id || right.pageId || right.slug);
  const leftProject = text(left.projectId);
  const rightProject = text(right.projectId);
  const leftOwner = text(left.ownerId || left.ownerAccountId);
  const rightOwner = text(right.ownerId || right.ownerAccountId);
  return !!leftId && leftId === rightId
    && (!leftProject || !rightProject || leftProject === rightProject)
    && (!leftOwner || !rightOwner || leftOwner === rightOwner);
}

export function pageDraftContentSignature(page) {
  const normalized = sanitizeValue(normalizePageForSave(page || {}));
  const comparable = { ...(normalized || {}) };
  for (const key of ['revision', 'updatedAt', 'savedAt', 'createdAt', '__accountProjectAccess']) delete comparable[key];
  return JSON.stringify(comparable);
}

function pruneDrafts(drafts, now = Date.now()) {
  const entries = Object.entries(drafts || {})
    .filter(([, draft]) => draft && now - Number(draft.editedAt || 0) <= MAX_DRAFT_AGE_MS)
    .sort(([, left], [, right]) => Number(right.editedAt || 0) - Number(left.editedAt || 0))
    .slice(0, MAX_DRAFTS);
  return Object.fromEntries(entries);
}

export function pageDraftIdentity(page = {}, authUser = {}) {
  const pageOwner = text(page.ownerId || page.ownerAccountId || 'owner');
  const account = text(authUser.ownerId || authUser.accountId || authUser.email || pageOwner || 'account');
  const project = text(page.projectId || authUser.workspaceId || authUser.projectId || 'project');
  const pageKey = text(page.id || page.pageId || page.slug || 'page');
  return [account, pageOwner, project, pageKey].map((part) => encodeURIComponent(part)).join(':');
}

export function savePageDraft({ page, authUser, editedAt = Date.now(), storage, interactionConfirmed = true } = {}) {
  const normalized = normalizePageForSave(page || {});
  const identity = pageDraftIdentity(normalized, authUser);
  const envelope = readEnvelope(storage);
  const draft = {
    version: DRAFT_VERSION,
    identity,
    editedAt,
    interactionConfirmed: interactionConfirmed === true,
    baseRevision: Number(normalized.revision || 0),
    baseUpdatedAt: text(normalized.updatedAt || normalized.savedAt || normalized.createdAt),
    page: sanitizeValue(normalized),
  };
  envelope.drafts = pruneDrafts({ ...envelope.drafts, [identity]: draft }, editedAt);
  return writeEnvelope(envelope, storage) ? draft : null;
}

export function readPageDraft({ page, authUser, storage } = {}) {
  const identity = pageDraftIdentity(page, authUser);
  return readEnvelope(storage).drafts[identity] || null;
}

export function clearPageDraft({ page, authUser, storage } = {}) {
  const identity = pageDraftIdentity(page, authUser);
  const envelope = readEnvelope(storage);
  let changed = false;
  for (const [key, draft] of Object.entries(envelope.drafts)) {
    const exactMatch = key === identity;
    const pageMatchWithoutAuth = !authUser && sameDraftPage(draft?.page || {}, page || {});
    if (!exactMatch && !pageMatchWithoutAuth) continue;
    delete envelope.drafts[key];
    changed = true;
  }
  if (!changed) return true;
  envelope.drafts = pruneDrafts(envelope.drafts);
  return writeEnvelope(envelope, storage);
}

export function evaluatePageDraft({ draft, serverPage, now = Date.now() } = {}) {
  if (!draft?.page) return { action: 'none' };
  if (draft.interactionConfirmed !== true) return { action: 'discard', reason: 'unconfirmed-edit' };
  if (now - Number(draft.editedAt || 0) > MAX_DRAFT_AGE_MS) return { action: 'discard', reason: 'expired' };
  const serverRevision = Number(serverPage?.revision || 0);
  const baseRevision = Number(draft.baseRevision || 0);
  if (serverRevision !== baseRevision) return { action: 'discard', reason: 'server-revision-changed' };
  const serverUpdatedAt = text(serverPage?.updatedAt || serverPage?.savedAt || serverPage?.createdAt);
  if (draft.baseUpdatedAt && serverUpdatedAt && draft.baseUpdatedAt !== serverUpdatedAt) {
    return { action: 'discard', reason: 'server-timestamp-changed' };
  }
  if (pageDraftContentSignature(draft.page) === pageDraftContentSignature(serverPage)) return { action: 'discard', reason: 'same-content' };
  if (serverUpdatedAt && Number(draft.editedAt || 0) <= timestamp(serverUpdatedAt)) return { action: 'discard', reason: 'server-newer' };
  return { action: 'restore', reason: 'newer-local-draft' };
}

export function restorePageDraft({ draft, serverPage } = {}) {
  const merged = mergeDraftValue(serverPage || {}, draft?.page || {});
  const identityFields = ['id', 'pageId', 'projectId', 'ownerId', 'ownerAccountId', 'revision', 'updatedAt', 'savedAt', 'createdAt'];
  for (const key of identityFields) {
    if (serverPage && Object.prototype.hasOwnProperty.call(serverPage, key)) merged[key] = serverPage[key];
  }
  return normalizePageForSave(merged);
}

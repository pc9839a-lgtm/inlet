import { PAGE_DRAFTS_KEY } from '../config/storageKeys.js';
import { isStorageQuotaError } from '../lib/storage.js';
import { normalizePageForSave } from '../lib/pageModel.js';

const DRAFT_VERSION = 1;
const MAX_DRAFTS = 12;
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DRAFT_SOURCE_SESSION_KEY = 'inlet-page-draft-source-v1';
const SENSITIVE_KEY = /(api[-_]?key|access[-_]?token|refresh[-_]?token|authorization|password|secret|credential)/i;
let fallbackDraftSourceId = '';

function safeStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage || null;
}

function safeSessionStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

function text(value) {
  return String(value || '').trim();
}

function newDraftSourceId() {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `tab-${random}`;
}

export function pageDraftSourceId(sessionStorage) {
  const target = safeSessionStorage(sessionStorage);
  if (target) {
    try {
      const existing = text(target.getItem(DRAFT_SOURCE_SESSION_KEY));
      if (existing) return existing;
      const created = newDraftSourceId();
      target.setItem(DRAFT_SOURCE_SESSION_KEY, created);
      return created;
    } catch {}
  }
  if (!fallbackDraftSourceId) fallbackDraftSourceId = newDraftSourceId();
  return fallbackDraftSourceId;
}

function draftStorageKey(identity, sourceId) {
  return `${identity}::${encodeURIComponent(text(sourceId) || 'shared')}`;
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

function writeEnvelopeResult(envelope, storage) {
  const target = safeStorage(storage);
  if (!target) {
    return {
      ok: false,
      reason: 'unavailable',
      error: new Error('localStorage is not available'),
    };
  }

  let payload = '';
  try {
    payload = JSON.stringify(envelope);
  } catch (error) {
    return { ok: false, reason: 'serialize', error };
  }

  try {
    target.setItem(PAGE_DRAFTS_KEY, payload);
    return { ok: true, reason: '', error: null };
  } catch (error) {
    return {
      ok: false,
      reason: isStorageQuotaError(error)
        ? 'quota'
        : error?.name === 'SecurityError'
          ? 'security'
          : 'storage',
      error,
    };
  }
}

function writeEnvelope(envelope, storage) {
  return writeEnvelopeResult(envelope, storage).ok;
}

export function pageDraftStorageFailureMessage(result = {}) {
  switch (result?.reason) {
    case 'quota':
      return '브라우저 저장 공간이 부족해 편집 내용을 임시 보관하지 못했습니다. 이 화면을 닫지 말고 큰 이미지나 오래된 임시 초안을 정리한 뒤 다시 저장해주세요.';
    case 'security':
      return '브라우저가 로컬 저장을 차단해 편집 내용을 임시 보관하지 못했습니다. 이 화면을 닫지 말고 사이트 저장 권한을 허용한 뒤 다시 저장해주세요.';
    case 'unavailable':
      return '이 브라우저에서 로컬 저장을 사용할 수 없어 편집 내용을 임시 보관하지 못했습니다. 이 화면을 닫지 말고 다시 저장해주세요.';
    case 'serialize':
      return '편집 내용을 브라우저 임시본으로 만들지 못했습니다. 이 화면을 닫지 말고 다시 저장해주세요.';
    default:
      return '편집 내용을 브라우저에 임시 보관하지 못했습니다. 이 화면을 닫지 말고 다시 저장해주세요.';
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

export function savePageDraftResult({
  page,
  authUser,
  editedAt = Date.now(),
  storage,
  sourceId,
  interactionConfirmed = true,
} = {}) {
  const normalized = normalizePageForSave(page || {});
  const identity = pageDraftIdentity(normalized, authUser);
  const resolvedSourceId = text(sourceId) || pageDraftSourceId();
  const envelope = readEnvelope(storage);
  const draft = {
    version: DRAFT_VERSION,
    identity,
    sourceId: resolvedSourceId,
    editedAt,
    interactionConfirmed: interactionConfirmed === true,
    baseRevision: Number(normalized.revision || 0),
    baseUpdatedAt: text(normalized.updatedAt || normalized.savedAt || normalized.createdAt),
    page: sanitizeValue(normalized),
  };
  envelope.drafts = pruneDrafts({
    ...envelope.drafts,
    [draftStorageKey(identity, resolvedSourceId)]: draft,
  }, editedAt);
  const writeResult = writeEnvelopeResult(envelope, storage);
  return writeResult.ok
    ? { ...writeResult, draft }
    : { ...writeResult, draft: null };
}

export function savePageDraft(options = {}) {
  return savePageDraftResult(options).draft;
}

export function readPageDraft({ page, authUser, storage, sourceId, includeOtherSources = false } = {}) {
  const identity = pageDraftIdentity(page, authUser);
  const resolvedSourceId = text(sourceId) || pageDraftSourceId();
  const drafts = readEnvelope(storage).drafts;
  const exact = drafts[draftStorageKey(identity, resolvedSourceId)] || drafts[identity] || null;
  if (exact || !includeOtherSources) return exact;
  const candidates = Object.entries(drafts)
    .filter(([key, draft]) => key === identity || draft?.identity === identity)
    .map(([, draft]) => draft)
    .filter(Boolean)
    .sort((left, right) => Number(right.editedAt || 0) - Number(left.editedAt || 0));
  return candidates[0] || null;
}

export function clearPageDraft({ page, authUser, storage, sourceId, allSources = false } = {}) {
  const identity = pageDraftIdentity(page, authUser);
  const resolvedSourceId = text(sourceId) || pageDraftSourceId();
  const envelope = readEnvelope(storage);
  const exactKey = draftStorageKey(identity, resolvedSourceId);
  let changed = false;
  for (const [key, draft] of Object.entries(envelope.drafts)) {
    const identityMatch = key === identity || draft?.identity === identity;
    const pageMatchWithoutAuth = !authUser && sameDraftPage(draft?.page || {}, page || {});
    if (!identityMatch && !pageMatchWithoutAuth) continue;
    const sourceMatch = allSources
      || !authUser
      || key === identity
      || key === exactKey
      || text(draft?.sourceId) === resolvedSourceId;
    if (!sourceMatch) continue;
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

  const draftSignature = pageDraftContentSignature(draft.page);
  const serverSignature = pageDraftContentSignature(serverPage);
  if (draftSignature === serverSignature) return { action: 'discard', reason: 'same-content' };

  const serverRevision = Number(serverPage?.revision || 0);
  const baseRevision = Number(draft.baseRevision || 0);
  if (serverRevision !== baseRevision) return { action: 'conflict', reason: 'server-revision-changed' };

  const serverUpdatedAt = text(serverPage?.updatedAt || serverPage?.savedAt || serverPage?.createdAt);
  if (draft.baseUpdatedAt && serverUpdatedAt && draft.baseUpdatedAt !== serverUpdatedAt) {
    return { action: 'conflict', reason: 'server-timestamp-changed' };
  }
  if (serverUpdatedAt && Number(draft.editedAt || 0) <= timestamp(serverUpdatedAt)) {
    return { action: 'conflict', reason: 'server-newer' };
  }
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

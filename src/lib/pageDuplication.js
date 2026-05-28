import { clone, ensureUniqueAnchors, normalizePageForSave, uid } from './pageModel.js';

const RESERVED_SLUGS = new Set(['admin', 'api', 'invite', 'login', 'signup', 'terms', 'privacy', 'contact']);

export function sanitizeDuplicateSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 48);
}

export function normalizePageDuplicateUrl(input = {}) {
  const domainType = input.domainType === 'custom' ? 'custom' : 'default';
  const slug = sanitizeDuplicateSlug(input.slug || 'copy-page') || 'copy-page';
  const customDomain = String(input.customDomain || '').trim().toLowerCase();
  return {
    domainType,
    slug,
    customDomain: domainType === 'custom' ? customDomain : '',
    domainStatus: domainType === 'custom' ? 'pending_dns' : 'ready',
  };
}

export function pageDuplicateUrlIssues(input = {}, currentPage = {}) {
  const rawSlug = sanitizeDuplicateSlug(input.slug || '');
  const url = normalizePageDuplicateUrl(input);
  const issues = [];
  if (!rawSlug) issues.push('기본 제공 도메인은 URL 경로가 필요합니다.');
  if (RESERVED_SLUGS.has(url.slug)) issues.push('예약어는 URL로 사용할 수 없습니다.');
  if (url.slug === sanitizeDuplicateSlug(currentPage.slug || '')) issues.push('현재 페이지와 다른 URL을 입력해주세요.');
  if (url.domainType === 'custom') {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.customDomain)) {
      issues.push('개인 도메인을 정확히 입력해주세요.');
    }
    if (url.customDomain && url.customDomain === String(currentPage.customDomain || '').trim().toLowerCase()) {
      issues.push('현재 페이지와 다른 개인 도메인을 입력해주세요.');
    }
  }
  return issues;
}

export function canUsePageDuplication(page = {}) {
  return !!(
    page?.features?.pageDuplication ||
    page?.plan?.features?.pageDuplication ||
    page?.billing?.features?.pageDuplication ||
    page?.entitlements?.pageDuplication
  );
}

function refreshNestedIds(value) {
  if (Array.isArray(value)) return value.map((item) => refreshNestedIds(item));
  if (!value || typeof value !== 'object') return value;
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = key === 'id' ? uid() : refreshNestedIds(item);
  }
  return next;
}

function duplicateBlocks(blocks = []) {
  return ensureUniqueAnchors((blocks || []).map((block) => ({
    ...refreshNestedIds(clone(block)),
    id: uid(),
  })));
}

export function createDuplicatedPage(sourcePage = {}, input = {}) {
  const url = normalizePageDuplicateUrl(input);
  const copied = clone(sourcePage);
  const next = normalizePageForSave({
    ...copied,
    id: uid(),
    pageId: uid(),
    title: input.title || `${sourcePage.title || '랜딩페이지'} 복제본`,
    slug: url.slug,
    domainType: url.domainType,
    customDomain: url.customDomain,
    domainStatus: url.domainStatus,
    url,
    blocks: duplicateBlocks(sourcePage.blocks || []),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  next.ownership = {
    ownerEmail: sourcePage.ownership?.ownerEmail || sourcePage.ownerEmail || '',
    clientEmail: sourcePage.ownership?.clientEmail || '',
    clientAccess: sourcePage.ownership?.clientAccess !== false,
    managers: [],
    transferRequest: null,
  };

  delete next.leads;
  delete next.leadsById;
  delete next.events;
  delete next.stats;
  delete next.leadStats;
  delete next.delivery;
  delete next.deliveryLogs;
  delete next.audit;
  delete next.auditHistory;
  delete next.invites;
  delete next.managerInvites;
  delete next.billing;
  delete next.payment;
  delete next.payments;
  delete next.subscription;
  delete next.subscriptions;
  delete next.ownershipTransferRequests;

  return next;
}

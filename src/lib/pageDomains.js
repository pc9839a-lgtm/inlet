export const PAGE_DOMAIN_TYPES = Object.freeze(['default', 'custom']);
export const PAGE_DOMAIN_STATUSES = Object.freeze(['ready', 'pending', 'verifying', 'active', 'failed', 'disconnected']);
export const PAGE_DOMAIN_SSL_STATUSES = Object.freeze(['not_applicable', 'pending', 'active', 'failed']);

const RESERVED_DOMAIN_SUFFIXES = Object.freeze([
  'pagero.kr',
  'pages.dev',
  'localhost',
]);

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function rawDomainValue(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeDomainHostname(value = '') {
  const raw = rawDomainValue(value);
  if (!raw) return '';
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return String(parsed.hostname || '').replace(/\.$/, '').toLowerCase();
  } catch {
    return raw
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .replace(/:\d+$/, '')
      .replace(/\.$/, '')
      .toLowerCase();
  }
}

export function isPageroOwnedHostname(hostname = '') {
  const safe = normalizeDomainHostname(hostname);
  return RESERVED_DOMAIN_SUFFIXES.some((suffix) => safe === suffix || safe.endsWith(`.${suffix}`));
}

export function pageDomainIssues(input = {}) {
  const domainType = input.domainType === 'custom' ? 'custom' : 'default';
  if (domainType !== 'custom') return [];

  const raw = rawDomainValue(input.customDomain || input.hostname || '');
  const hostname = normalizeDomainHostname(raw);
  const issues = [];

  if (!hostname) issues.push('연결할 개인 도메인을 입력해주세요.');
  if (raw && /[/?#]/.test(raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''))) {
    issues.push('도메인에는 경로나 검색어를 넣을 수 없습니다.');
  }
  if (raw && /@/.test(raw)) issues.push('도메인에는 계정 정보를 넣을 수 없습니다.');
  if (raw && /:\d+$/.test(raw)) issues.push('도메인에는 포트 번호를 넣을 수 없습니다.');
  if (hostname && (hostname.includes('*') || hostname.startsWith('.'))) issues.push('와일드카드 도메인은 연결할 수 없습니다.');
  if (hostname && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) issues.push('IP 주소는 개인 도메인으로 사용할 수 없습니다.');
  if (hostname && !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/i.test(hostname)) {
    issues.push('도메인 형식이 올바르지 않습니다.');
  }
  if (hostname && isPageroOwnedHostname(hostname)) issues.push('페이지로 운영 도메인은 개인 도메인으로 등록할 수 없습니다.');

  return [...new Set(issues)];
}

export function normalizePageDomainConfig(input = {}) {
  const nested = input?.url && typeof input.url === 'object' ? input.url : {};
  const domainType = (input.domainType || nested.domainType) === 'custom' ? 'custom' : 'default';
  const slug = String(input.slug || nested.slug || 'my-page').replace(/[^a-zA-Z0-9-_]/g, '') || 'my-page';
  const customDomain = domainType === 'custom'
    ? normalizeDomainHostname(input.customDomain || input.hostname || nested.customDomain || nested.hostname || '')
    : '';
  const rawStatus = String(input.domainStatus || nested.domainStatus || '').trim().toLowerCase();
  const legacyStatus = rawStatus === 'pending_dns' ? 'pending' : rawStatus;
  const domainStatus = domainType === 'custom'
    ? pick(legacyStatus, PAGE_DOMAIN_STATUSES, 'pending')
    : 'ready';
  const sslStatus = domainType === 'custom'
    ? pick(String(input.sslStatus || nested.sslStatus || '').trim().toLowerCase(), PAGE_DOMAIN_SSL_STATUSES, domainStatus === 'active' ? 'active' : 'pending')
    : 'not_applicable';

  return {
    domainType,
    slug,
    customDomain,
    domainStatus,
    sslStatus,
    domainFailureReason: domainType === 'custom'
      ? String(input.domainFailureReason || nested.domainFailureReason || '').trim().slice(0, 300)
      : '',
    domainLastCheckedAt: domainType === 'custom'
      ? String(input.domainLastCheckedAt || nested.domainLastCheckedAt || '').trim()
      : '',
  };
}

export function applyPageDomainConfig(page = {}, input = {}) {
  const domain = normalizePageDomainConfig({ ...page, ...input, url: { ...(page.url || {}), ...(input.url || {}) } });
  return {
    ...page,
    ...domain,
    url: {
      ...(page.url || {}),
      ...domain,
    },
  };
}

export function pageDomainStatusLabel(status = '') {
  return ({
    ready: '기본 주소 사용 중',
    pending: 'DNS 연결 대기',
    verifying: '연결 확인 중',
    active: '연결 완료',
    failed: '연결 실패',
    disconnected: '연결 해제됨',
  })[status] || 'DNS 연결 대기';
}

export function pageDomainStatusTone(status = '') {
  if (status === 'active' || status === 'ready') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'disconnected') return 'muted';
  return 'warning';
}

export function pagePublicUrl(page = {}, defaultOrigin = 'https://pagero.kr') {
  const domain = normalizePageDomainConfig(page);
  if (domain.domainType === 'custom' && domain.domainStatus === 'active' && domain.customDomain) {
    return `https://${domain.customDomain}`;
  }
  return `${String(defaultOrigin || 'https://pagero.kr').replace(/\/$/, '')}/${encodeURIComponent(domain.slug)}`;
}

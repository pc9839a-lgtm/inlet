import { createHash } from 'node:crypto';

const REGION_PATTERN = /^(?:af|ap|ca|eu|il|me|mx|sa|us)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d$/;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeSesRegion(value = '') {
  const region = String(value || '').trim().toLowerCase();
  return REGION_PATTERN.test(region) ? region : '';
}

export function extractSenderEmail(value = '') {
  const raw = String(value || '').trim();
  const bracket = raw.match(/<([^<>]+)>/);
  const email = String(bracket?.[1] || raw).trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : '';
}

export function normalizeIdentity(value = '') {
  const raw = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (EMAIL_PATTERN.test(raw)) return raw;
  return DOMAIN_PATTERN.test(raw) ? raw : '';
}

export function identityDomain(identity = '') {
  const normalized = normalizeIdentity(identity);
  if (!normalized) return '';
  return normalized.includes('@') ? normalized.split('@').pop() : normalized;
}

export function senderMatchesIdentity(senderEmail = '', identity = '') {
  const sender = extractSenderEmail(senderEmail);
  const normalizedIdentity = normalizeIdentity(identity);
  if (!sender || !normalizedIdentity) return false;
  if (normalizedIdentity.includes('@')) return sender === normalizedIdentity;
  const domain = sender.split('@').pop();
  return domain === normalizedIdentity || domain.endsWith(`.${normalizedIdentity}`);
}

export function normalizeDnsName(value = '') {
  const name = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  return DOMAIN_PATTERN.test(name) ? name : '';
}

export function sesApiOrigin(region = '') {
  const safeRegion = normalizeSesRegion(region);
  return safeRegion ? `https://email.${safeRegion}.amazonaws.com` : '';
}

export function evaluateSesAuthEmailGate(env = {}) {
  const region = normalizeSesRegion(env.INLET_SES_REGION || env.AWS_SES_REGION || env.AWS_REGION || 'ap-northeast-2');
  const accessKeyId = String(env.INLET_SES_ACCESS_KEY_ID || env.AWS_SES_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.INLET_SES_SECRET_ACCESS_KEY || env.AWS_SES_SECRET_ACCESS_KEY || '').trim();
  const senderEmail = extractSenderEmail(env.INLET_AUTH_EMAIL_FROM || '');
  const identity = normalizeIdentity(env.INLET_SES_IDENTITY || identityDomain(senderEmail));
  const requireLive = String(env.INLET_SES_REQUIRE_LIVE || '1').trim() !== '0';
  const errors = [];

  if (!region) errors.push('SES region is invalid');
  if (accessKeyId.length < 16 || accessKeyId.length > 128) errors.push('SES access key is missing or invalid');
  if (secretAccessKey.length < 32 || secretAccessKey.length > 256) errors.push('SES secret key is missing or invalid');
  if (!senderEmail) errors.push('auth email sender is missing or invalid');
  if (!identity) errors.push('SES identity is missing or invalid');
  if (senderEmail && identity && !senderMatchesIdentity(senderEmail, identity)) errors.push('sender does not belong to the SES identity');

  return {
    ok: errors.length === 0,
    status: errors.length ? (requireLive ? 'failed-live' : 'skipped-live') : 'ready-live',
    errors,
    config: {
      region,
      accessKeyId,
      secretAccessKey,
      senderEmail,
      identity,
      requireLive,
      requireDmarc: String(env.INLET_SES_REQUIRE_DMARC || '1').trim() !== '0',
      requireCustomMailFrom: String(env.INLET_SES_REQUIRE_CUSTOM_MAIL_FROM || '').trim() === '1',
      timeoutMs: boundedTimeout(env.INLET_SES_TIMEOUT_MS),
    },
  };
}

export function boundedTimeout(value = '') {
  const parsed = Number(value || 15000);
  if (!Number.isFinite(parsed)) return 15000;
  return Math.min(60000, Math.max(5000, Math.trunc(parsed)));
}

export function stableDigest(value = '') {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

export function sanitizeEvidence(value, secrets = []) {
  const blocked = secrets.map((item) => String(item || '')).filter(Boolean);
  const sensitiveKey = /access.?key|secret|authorization|credential|signature|token|identity|sender|email|domain|dns.?name|request.?id|message/i;
  const walk = (item, key = '') => {
    if (sensitiveKey.test(key)) return '[redacted]';
    if (Array.isArray(item)) return item.map((child) => walk(child));
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).map(([childKey, child]) => [childKey, walk(child, childKey)]));
    }
    if (typeof item !== 'string') return item;
    let output = item;
    for (const secret of blocked) output = output.split(secret).join('[redacted]');
    return output;
  };
  return walk(value);
}

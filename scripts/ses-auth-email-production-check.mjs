import { createHash, createHmac } from 'node:crypto';
import {
  evaluateSesAuthEmailGate,
  identityDomain,
  normalizeDnsName,
  sanitizeEvidence,
  sesApiOrigin,
  stableDigest,
} from './ses-auth-email-production-safety.mjs';

const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');
const DNS_ORIGIN = 'https://cloudflare-dns.com';
const DNS_PATH = '/dns-query';

export async function runSesAuthEmailProductionCheck(env = process.env, options = {}) {
  const gate = evaluateSesAuthEmailGate(env);
  if (!gate.ok) {
    const evidence = {
      ok: false,
      status: gate.status,
      check: 'ses-auth-email-production-verification',
      blockedBeforeNetwork: true,
      reasonCodes: gate.errors.map(reasonCode),
      writesPerformed: false,
      emailsSent: false,
    };
    emitEvidence(evidence, env, gate.config);
    if (gate.config.requireLive) process.exitCode = 1;
    return evidence;
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
  const config = gate.config;
  const account = await signedSesGet('/v2/email/account', config, fetchImpl);
  const identity = await signedSesGet(`/v2/email/identities/${encodeURIComponent(config.identity)}`, config, fetchImpl);
  const identityDomainName = identityDomain(config.identity);
  const dmarc = await queryTxt(`_dmarc.${identityDomainName}`, config, fetchImpl);
  const mailFromDomain = normalizeDnsName(identity?.MailFromAttributes?.MailFromDomain || '');
  const spf = mailFromDomain ? await queryTxt(mailFromDomain, config, fetchImpl) : { records: [], queryOk: true };

  const productionAccessEnabled = account?.ProductionAccessEnabled === true;
  const sendingEnabled = account?.SendingEnabled === true;
  const identityVerified = identity?.VerifiedForSendingStatus === true;
  const dkimStatus = String(identity?.DkimAttributes?.Status || '').toUpperCase();
  const dkimReady = identity?.DkimAttributes?.SigningEnabled !== false && ['SUCCESS', 'ACTIVE'].includes(dkimStatus);
  const dmarcReady = dmarc.records.some((record) => /^v=DMARC1(?:;|\s|$)/i.test(record));
  const mailFromStatus = String(identity?.MailFromAttributes?.MailFromDomainStatus || '').toUpperCase();
  const customMailFromConfigured = !!mailFromDomain;
  const customMailFromReady = customMailFromConfigured
    && ['SUCCESS', 'ACTIVE'].includes(mailFromStatus)
    && spf.records.some((record) => /^v=spf1\b/i.test(record) && /include:amazonses\.com/i.test(record));
  const ready = productionAccessEnabled
    && sendingEnabled
    && identityVerified
    && dkimReady
    && (!config.requireDmarc || dmarcReady)
    && (!config.requireCustomMailFrom || customMailFromReady);

  const evidence = {
    ok: ready,
    status: ready ? 'verified-live' : 'failed-live',
    check: 'ses-auth-email-production-verification',
    readOnly: true,
    writesPerformed: false,
    emailsSent: false,
    awsEndpointFixed: true,
    redirectsBlocked: true,
    identityDigest: stableDigest(config.identity),
    results: {
      productionAccessEnabled,
      sendingEnabled,
      identityVerified,
      dkimReady,
      dmarcRequired: config.requireDmarc,
      dmarcReady,
      customMailFromRequired: config.requireCustomMailFrom,
      customMailFromConfigured,
      customMailFromReady,
    },
  };
  emitEvidence(evidence, env, config);
  if (!ready && config.requireLive) process.exitCode = 1;
  return evidence;
}

async function signedSesGet(pathname, config, fetchImpl) {
  if (!pathname.startsWith('/v2/email/') || pathname.includes('?') || pathname.includes('#')) {
    throw new Error('unapproved SES API path');
  }
  const origin = sesApiOrigin(config.region);
  if (!origin) throw new Error('invalid SES origin');
  const url = new URL(pathname, origin);
  if (url.origin !== origin || !url.pathname.startsWith('/v2/email/')) throw new Error('SES destination changed');
  const host = url.host;
  const amzDate = awsAmzDate(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-date';
  const canonicalRequest = ['GET', url.pathname, '', canonicalHeaders, signedHeaders, EMPTY_SHA256].join('\n');
  const scope = `${dateStamp}/${config.region}/ses/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = awsSigningKey(config.secretAccessKey, dateStamp, config.region, 'ses');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'X-Amz-Date': amzDate,
      Authorization: authorization,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`SES read failed with HTTP ${response.status}`);
    error.code = 'SES_READ_FAILED';
    throw error;
  }
  return data;
}

async function queryTxt(name, config, fetchImpl) {
  const safeName = normalizeDnsName(name);
  if (!safeName) throw new Error('invalid DNS name');
  const url = new URL(DNS_PATH, DNS_ORIGIN);
  url.searchParams.set('name', safeName);
  url.searchParams.set('type', 'TXT');
  if (url.origin !== DNS_ORIGIN || url.pathname !== DNS_PATH) throw new Error('DNS destination changed');
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/dns-json' },
    redirect: 'error',
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { queryOk: false, records: [] };
  return {
    queryOk: true,
    records: (Array.isArray(data.Answer) ? data.Answer : [])
      .filter((item) => Number(item?.type) === 16)
      .map((item) => String(item?.data || '').replace(/^"|"$/g, '').replace(/"\s+"/g, '')),
  };
}

function awsAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function awsSigningKey(secret, dateStamp, region, service) {
  const dateKey = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update(service).digest();
  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

function reasonCode(message = '') {
  return String(message || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'INVALID_CONFIG';
}

function emitEvidence(evidence, env, config = {}) {
  const safe = sanitizeEvidence(evidence, [
    env.INLET_SES_ACCESS_KEY_ID,
    env.AWS_SES_ACCESS_KEY_ID,
    env.INLET_SES_SECRET_ACCESS_KEY,
    env.AWS_SES_SECRET_ACCESS_KEY,
    env.INLET_AUTH_EMAIL_FROM,
    env.INLET_SES_IDENTITY,
    config.accessKeyId,
    config.secretAccessKey,
    config.senderEmail,
    config.identity,
  ]);
  console.log(JSON.stringify(safe, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSesAuthEmailProductionCheck().catch((error) => {
    console.log(JSON.stringify({
      ok: false,
      status: 'failed-live',
      check: 'ses-auth-email-production-verification',
      errorCode: String(error?.code || 'SES_AUTH_EMAIL_CHECK_FAILED'),
      writesPerformed: false,
      emailsSent: false,
    }, null, 2));
    process.exitCode = 1;
  });
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateSesAuthEmailGate, sanitizeEvidence } from './ses-auth-email-production-safety.mjs';
import { runSesAuthEmailProductionCheck } from './ses-auth-email-production-check.mjs';

const root = process.cwd();
const read = (path) => readFile(`${root}/${path}`, 'utf8');
const [workflow, docs, packageJson, qaAll, envExample, checkSource, safetySource] = await Promise.all([
  read('.github/workflows/ses-auth-email-production-verify.yml'),
  read('docs/ops-ses-auth-email-production-verification.md'),
  read('package.json'),
  read('scripts/qa-all.mjs'),
  read('.env.example'),
  read('scripts/ses-auth-email-production-check.mjs'),
  read('scripts/ses-auth-email-production-safety.mjs'),
]);

for (const token of [
  'workflow_dispatch',
  'environment: production',
  'npm run auth:email:ses:live',
  'ses-auth-email-production-evidence-${{ github.run_id }}',
  'retention-days: 30',
]) assert(workflow.includes(token), `workflow missing ${token}`);
assert(!/\bpush\s*:|\bpull_request\s*:|\bschedule\s*:/.test(workflow), 'SES verifier must stay manual-only');
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);

for (const token of [
  'SES Auth Email Production Verification',
  '읽기 전용',
  'ProductionAccessEnabled',
  'DKIM',
  'DMARC',
  'custom MAIL FROM',
  '이메일을 발송하지 않는다',
  'verified-live',
]) assert(docs.includes(token), `runbook missing ${token}`);

const pkg = JSON.parse(packageJson);
assert.equal(pkg.scripts['auth:email:ses:live'], 'node scripts/ses-auth-email-production-check.mjs');
assert.equal(pkg.scripts['auth:email:ses:contract:qa'], 'node scripts/ses-auth-email-production-contract-check.mjs');
assert.match(qaAll, /auth:email:ses:contract:qa/);

for (const token of [
  "redirect: 'error'",
  "method: 'GET'",
  '/v2/email/account',
  '/v2/email/identities/',
  'cloudflare-dns.com',
  'emailsSent: false',
  'writesPerformed: false',
]) assert(checkSource.includes(token), `check source missing ${token}`);
assert(!checkSource.includes('/v2/email/outbound-emails'), 'read-only verifier must not call SES send endpoint');
assert(!/method:\s*['"]POST['"]/.test(checkSource), 'read-only verifier must not POST');
assert(safetySource.includes('senderMatchesIdentity'));
assert(safetySource.includes('sanitizeEvidence'));

for (const token of [
  'INLET_SES_REGION',
  'INLET_SES_ACCESS_KEY_ID',
  'INLET_SES_SECRET_ACCESS_KEY',
  'INLET_AUTH_EMAIL_FROM',
  'INLET_SES_IDENTITY',
]) assert(envExample.includes(token), `.env.example missing ${token}`);

const baseEnv = {
  INLET_SES_REGION: 'ap-northeast-2',
  INLET_SES_ACCESS_KEY_ID: 'AKIA1234567890QAKEY',
  INLET_SES_SECRET_ACCESS_KEY: 'qa-secret-that-is-longer-than-thirty-two-characters',
  INLET_AUTH_EMAIL_FROM: '페이지로 <support@qa-mail.pagero.test>',
  INLET_SES_IDENTITY: 'qa-mail.pagero.test',
  INLET_SES_REQUIRE_LIVE: '1',
  INLET_SES_REQUIRE_DMARC: '1',
  INLET_SES_REQUIRE_CUSTOM_MAIL_FROM: '1',
};
assert.equal(evaluateSesAuthEmailGate(baseEnv).ok, true);
for (const bad of [
  { INLET_SES_REGION: 'ap-northeast-2.attacker.example' },
  { INLET_SES_ACCESS_KEY_ID: 'short' },
  { INLET_SES_SECRET_ACCESS_KEY: 'short' },
  { INLET_AUTH_EMAIL_FROM: 'not-an-email' },
  { INLET_SES_IDENTITY: 'attacker.example' },
]) {
  assert.equal(evaluateSesAuthEmailGate({ ...baseEnv, ...bad }).ok, false);
}

const calls = [];
const fetchImpl = async (input, init = {}) => {
  const url = new URL(String(input));
  calls.push({ url, init });
  assert.equal(init.method, 'GET');
  assert.equal(init.redirect, 'error');
  if (url.hostname.startsWith('email.')) {
    assert.equal(url.hostname, 'email.ap-northeast-2.amazonaws.com');
    assert.match(String(init.headers?.Authorization || ''), /^AWS4-HMAC-SHA256 /);
    if (url.pathname === '/v2/email/account') {
      return jsonResponse({ ProductionAccessEnabled: true, SendingEnabled: true });
    }
    if (url.pathname.startsWith('/v2/email/identities/')) {
      return jsonResponse({
        VerifiedForSendingStatus: true,
        DkimAttributes: { SigningEnabled: true, Status: 'SUCCESS' },
        MailFromAttributes: { MailFromDomain: 'mail.qa-mail.pagero.test', MailFromDomainStatus: 'SUCCESS' },
      });
    }
  }
  assert.equal(url.origin, 'https://cloudflare-dns.com');
  assert.equal(url.pathname, '/dns-query');
  const name = url.searchParams.get('name');
  if (name === '_dmarc.qa-mail.pagero.test') return jsonResponse({ Answer: [{ type: 16, data: '"v=DMARC1; p=quarantine"' }] });
  if (name === 'mail.qa-mail.pagero.test') return jsonResponse({ Answer: [{ type: 16, data: '"v=spf1 include:amazonses.com -all"' }] });
  throw new Error(`unexpected URL ${url}`);
};

const originalLog = console.log;
let output = '';
console.log = (value) => { output += String(value); };
let result;
try {
  result = await runSesAuthEmailProductionCheck(baseEnv, { fetchImpl });
} finally {
  console.log = originalLog;
  process.exitCode = 0;
}
assert.equal(result.status, 'verified-live');
assert.equal(result.emailsSent, false);
assert.equal(result.writesPerformed, false);
assert.equal(calls.length, 4);
for (const secret of [
  baseEnv.INLET_SES_ACCESS_KEY_ID,
  baseEnv.INLET_SES_SECRET_ACCESS_KEY,
  'support@qa-mail.pagero.test',
  'qa-mail.pagero.test',
  'mail.qa-mail.pagero.test',
]) assert(!output.includes(secret), `evidence leaked ${secret}`);

const sanitized = JSON.stringify(sanitizeEvidence({ Authorization: 'secret', senderEmail: 'a@b.test', ok: true }, ['secret']));
assert(!sanitized.includes('a@b.test'));
assert(!sanitized.includes('secret'));

console.log(JSON.stringify({
  ok: true,
  check: 'ses-auth-email-production-verification-contract',
  manualOnly: true,
  readOnly: true,
  emailsSent: false,
  fixedAwsEndpoint: true,
  redirectsBlocked: true,
  productionAccessChecked: true,
  dkimChecked: true,
  dmarcChecked: true,
  customMailFromSpfChecked: true,
  evidenceRedacted: true,
}, null, 2));

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return data; },
  };
}

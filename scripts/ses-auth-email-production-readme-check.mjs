import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('scripts/ses-auth-email-production-check.mjs', 'utf8');
const workflow = await readFile('.github/workflows/ses-auth-email-production-verify.yml', 'utf8');

assert(!source.includes('/v2/email/outbound-emails'));
assert(!/method:\s*['"]POST['"]/.test(source));
assert(source.includes("redirect: 'error'"));
assert(source.includes("method: 'GET'"));
assert(workflow.includes('environment: production'));
assert(!/\bpush\s*:|\bpull_request\s*:|\bschedule\s*:/.test(workflow));

console.log(JSON.stringify({
  ok: true,
  check: 'ses-auth-email-read-only-boundary',
  outboundEmailEndpointPresent: false,
  postRequestsPresent: false,
  manualOnly: true,
}, null, 2));

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const docsDir = path.join(root, 'docs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = await readFile(path.join(docsDir, 'README.md'), 'utf8');
const master = await readFile(path.join(docsDir, 'PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md'), 'utf8');
const authPolicy = await readFile(path.join(docsDir, 'ops-auth-security-policy.md'), 'utf8');
const sesRunbook = await readFile(path.join(docsDir, 'ops-ses-auth-email-production-verification.md'), 'utf8');

const entries = (await readdir(docsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
  .map((entry) => entry.name)
  .sort();

const required = [
  'README.md',
  'PAGERO_MAINTENANCE_HANDOFF_KO.md',
  'PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md',
  'PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md',
  'PAGERO_PLAN_POLICY_KO.md',
  'UNIFIED_PAGERO_CALLTAG_BILLING_REFERRAL_KO.md',
  'ops-auth-security-policy.md',
  'ops-admin-audit-log.md',
  'ops-pii-retention-export-policy.md',
  'ops-storage-migration-policy.md',
  'ops-account-page-limit-production-verification.md',
  'ops-admin-audit-production-verification.md',
  'ops-conversion-production-verification.md',
  'ops-d1-migration-safety.md',
  'ops-deployment-cache-seo-checklist.md',
  'ops-google-sheets-production-verification.md',
  'ops-live-integration-matrix.md',
  'ops-operator-readiness-checklist.md',
  'ops-pagero-production-launch-smoke.md',
  'ops-ses-auth-email-production-verification.md',
];

const retired = [
  'CALLLINK_AUTH_ENTITLEMENT_KO.md',
  'CALLTAG_GOOGLE_PLAY_BILLING_ENV_20260812_KO.md',
  'CALLTAG_PAGERO_REALTIME_PUSH_KO.md',
  'ops-auth-email-runtime-risks.md',
  'ops-auth-email-abuse-protection.md',
  'ops-auth-login-abuse-protection.md',
  'ops-auth-session-revocation.md',
  'ops-auth-verification-enumeration.md',
  'ops-auth-verification-purpose-consumption.md',
  'ops-ses-auth-email-production-checklist.md',
];

for (const file of required) {
  assert(entries.includes(file), 'required current doc missing: ' + file);
}

for (const file of retired) {
  assert(!entries.includes(file), 'retired doc must not return: ' + file);
}

const currentDocContents = [];
for (const file of entries) {
  currentDocContents.push({
    file,
    content: await readFile(path.join(docsDir, file), 'utf8'),
  });
}

for (const retiredFile of retired) {
  for (const doc of currentDocContents) {
    assert(!doc.content.includes(retiredFile), 'current doc references retired file ' + retiredFile + ': ' + doc.file);
  }
}

for (const doc of currentDocContents) {
  assert(!doc.content.includes('병합 SHA:'), 'historical merge SHA snapshot must not remain in current docs: ' + doc.file);
  assert(!doc.content.includes('Workflow Run ID:'), 'historical workflow run snapshot must not remain in current docs: ' + doc.file);
  assert(!doc.content.includes('Job ID:'), 'historical job snapshot must not remain in current docs: ' + doc.file);
}

const forbiddenName = /(?:^|[-_])(final|fix|hotfix)(?:[-_.]|$)|[-_]v\d+(?:[-_.]|$)|_20\d{6,8}(?:_|\.|$)/i;
for (const file of entries) {
  assert(!forbiddenName.test(file), 'dated/patch-layer doc filename is forbidden: ' + file);
  assert(index.includes('`' + file + '`'), 'docs/README.md inventory missing: ' + file);

  if (file === 'README.md') {
    assert(index.includes('| INDEX | `README.md` |'), 'README index role classification missing');
  } else {
    const sourceRow = '| SOURCE | `' + file + '` |';
    const runbookRow = '| RUNBOOK | `' + file + '` |';
    assert(index.includes(sourceRow) || index.includes(runbookRow), 'docs/README.md role classification missing: ' + file);
  }
}

for (const token of [
  'E0 유지보수 정리 | 완료',
  'E4 AI first-page | 구현 완료',
  'P6 설정 UX | 완료',
  'B3 production smoke는 현재 스킵',
  'P5 개인 도메인 current-main 재구성',
  'P7 웹 결제',
  'P9 접근성 audit',
  'P8 대량 데이터',
  'E5 A/B test',
]) {
  assert(master.includes(token), 'current PageRo master missing: ' + token);
}

for (const stale of [
  'E1 편집기 shell 단순화 — 진행 중',
  'E2 섹션 패턴 — 진행 중',
  'feat/pagero-editor-shell-e1-20260921',
  'feat/pagero-section-patterns-e2-20260921',
  'stacked branch:',
  '패치 브랜치:',
]) {
  assert(!master.includes(stale), 'current PageRo master contains stale execution state: ' + stale);
}

for (const token of [
  'scripts/auth-email-quality-check.mjs',
  'scripts/auth-email-abuse-quality-check.mjs',
  'scripts/auth-login-abuse-quality-check.mjs',
  'scripts/auth-session-revocation-quality-check.mjs',
  'scripts/auth-verification-enumeration-quality-check.mjs',
  'scripts/auth-verification-purpose-consumption-quality-check.mjs',
]) {
  assert(authPolicy.includes(token), 'auth security policy missing QA contract: ' + token);
}

assert(sesRunbook.includes('## 운영 전 체크리스트'), 'SES checklist must stay folded into the verification runbook');
assert(!sesRunbook.includes('ops-ses-auth-email-production-checklist.md'), 'SES runbook must not depend on retired checklist file');

console.log(JSON.stringify({
  ok: true,
  docs: entries.length,
  indexed: entries.length,
  required: required.length,
  retiredBlocked: retired.length,
  policy: 'single-index-current-source',
}, null, 2));

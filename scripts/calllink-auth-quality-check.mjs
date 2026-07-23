import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'migrations/0006_calllink_app_accounts.sql',
  'functions/api/call/_shared.js',
  'functions/api/call/register.js',
  'functions/api/call/login.js',
  'functions/api/call/session.js',
  'functions/api/call/account.js',
  'functions/api/call/admin/entitlement.js',
  'functions/_middleware.js',
  'public/call/index.html',
  'public/call/privacy/index.html',
  'public/call/terms/index.html',
  'public/call/subscribe/index.html',
];

const textByFile = new Map();
for (const file of requiredFiles) {
  textByFile.set(file, await readFile(file, 'utf8'));
}

function assertIncludes(file, tokens) {
  const text = textByFile.get(file) || '';
  for (const token of tokens) {
    if (!text.includes(token)) throw new Error(`${file} is missing required token: ${token}`);
  }
}

assertIncludes('migrations/0006_calllink_app_accounts.sql', [
  'calllink_profiles',
  'brand_name',
  'industry',
  'calllink_entitlements',
  'pending_payment',
  'paid_until',
]);
assertIncludes('functions/api/call/register.js', [
  'registerAccount',
  'upsertCallProfile',
  'ensurePendingEntitlement',
  'brandName',
  'industry',
]);
assertIncludes('functions/api/call/login.js', ['loginAccount', 'entitlementPublic']);
assertIncludes('functions/api/call/session.js', ['callSession']);
assertIncludes('functions/api/call/admin/entitlement.js', [
  'X-CallLink-Admin',
  'CALLLINK_ADMIN_TOKEN',
  'paymentCustomerId',
]);
assertIncludes('functions/_middleware.js', [
  "url.hostname !== 'call.pagero.kr'",
  "context.env.ASSETS.fetch",
  "'/privacy'",
  "'/subscribe'",
]);
assertIncludes('public/call/index.html', [
  '이메일 인증번호',
  '브랜드명',
  '업종',
  '/api/call/register',
  '/api/call/login',
  '/api/auth/password',
]);
assertIncludes('public/call/privacy/index.html', [
  '이름, 휴대폰번호, 이메일주소',
  '비밀번호 원문은 저장하지 않습니다',
]);

const jsFiles = requiredFiles.filter((file) => file.endsWith('.js'));
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${file} syntax check failed:\n${result.stderr || result.stdout}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  feature: 'calllink-auth-entitlement',
  files: requiredFiles.length,
  syntaxChecked: jsFiles.length,
}, null, 2));

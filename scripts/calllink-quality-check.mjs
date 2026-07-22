import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(process.cwd());
const requiredFiles = [
  'migrations/0006_calllink_messaging.sql',
  'functions/api/calllink/_shared.js',
  'functions/api/calllink/connection-code.js',
  'functions/api/calllink/connect.js',
  'functions/api/calllink/session.js',
  'functions/api/calllink/channels.js',
  'functions/api/calllink/balance.js',
  'functions/api/calllink/pricing.js',
  'functions/api/calllink/messages/send.js',
  'functions/api/calllink/messages/history.js',
  'functions/api/calllink/wallet/credit.js',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  throw new Error(`CallLink required files missing: ${missing.join(', ')}`);
}

const migration = fs.readFileSync(path.join(root, requiredFiles[0]), 'utf8');
for (const table of [
  'calllink_connection_codes',
  'calllink_devices',
  'calllink_channels',
  'calllink_wallets',
  'calllink_wallet_transactions',
  'calllink_message_logs',
]) {
  if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    throw new Error(`CallLink migration missing table: ${table}`);
  }
}

const shared = fs.readFileSync(path.join(root, 'functions/api/calllink/_shared.js'), 'utf8');
if (!shared.includes('HMAC-SHA256')) throw new Error('SOLAPI HMAC authentication is missing.');
if (!shared.includes('SOLAPI_API_SECRET')) throw new Error('SOLAPI secret environment binding is missing.');
if (/SOLAPI_API_SECRET\s*=\s*['"][^'"]+['"]/.test(shared)) {
  throw new Error('Hard-coded SOLAPI API secret detected.');
}

const send = fs.readFileSync(path.join(root, 'functions/api/calllink/messages/send.js'), 'utf8');
if (!send.includes('MAX_MESSAGES = 100')) throw new Error('Server send limit is missing.');
if (!send.includes('disableSms: !config.fallbackSmsEnabled')) {
  throw new Error('Alimtalk fallback SMS policy is missing.');
}
if (!send.includes('CALLLINK_BALANCE_INSUFFICIENT')) {
  throw new Error('Prepaid balance guard is missing.');
}
if (send.includes('body.from')) throw new Error('Client-controlled sender number is not allowed.');
if (send.includes('body.kakaoTemplateId')) throw new Error('Client-controlled Kakao template ID is not allowed.');

for (const file of requiredFiles.filter((file) => file.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
}

console.log('CallLink server quality check passed.');

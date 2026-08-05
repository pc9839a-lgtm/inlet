import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertSecureSyncReady,
  decryptRecord,
  encryptRecord,
  phoneSearchHash,
  sanitizeSyncPayload,
} from '../functions/api/calltag-sync/_shared.js';

const KEY_A = Buffer.alloc(32, 0x41).toString('base64');
const KEY_B = Buffer.alloc(32, 0x42).toString('base64');
const env = {
  CALLTAG_SECURE_SYNC_ENABLED: '1',
  CALLTAG_DATA_ENCRYPTION_KEY: KEY_A,
  CALLTAG_DATA_SEARCH_KEY: KEY_B,
};

const results = [];
async function check(name, action) {
  try {
    await action();
    results.push([name, true]);
  } catch (error) {
    results.push([name, false, error]);
  }
}

await check('feature flag defaults to blocked', async () => {
  assert.throws(() => assertSecureSyncReady({}), /준비 중/);
});

await check('invalid encryption key is blocked', async () => {
  assert.throws(() => assertSecureSyncReady({
    CALLTAG_SECURE_SYNC_ENABLED: '1',
    CALLTAG_DATA_ENCRYPTION_KEY: 'bad',
    CALLTAG_DATA_SEARCH_KEY: KEY_B,
  }), /설정이 올바르지 않습니다/);
});

await check('payload whitelist strips owner and unknown fields', async () => {
  const value = sanitizeSyncPayload('customer', {
    ownerId: 'attacker-owner',
    displayName: '홍길동',
    primaryPhone: '010-1234-5678',
    memo: '상담 메모',
    unknownSecret: 'must-not-store',
  });
  assert.equal(value.displayName, '홍길동');
  assert.equal(value.primaryPhone, '010-1234-5678');
  assert.equal(value.ownerId, undefined);
  assert.equal(value.unknownSecret, undefined);
});

await check('AES-GCM round trip succeeds', async () => {
  const payload = { displayName: '홍길동', primaryPhone: '01012345678', memo: '상담 메모' };
  const encrypted = await encryptRecord(env, 'owner-a', 'customer', 'local-1', 3, payload);
  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.iv);
  assert.equal(encrypted.ciphertext.includes('홍길동'), false);
  const decoded = await decryptRecord(env, {
    owner_id: 'owner-a',
    entity_type: 'customer',
    entity_id: 'local-1',
    version: 3,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
  });
  assert.deepEqual(decoded, payload);
});

await check('AAD prevents cross-owner decryption', async () => {
  const encrypted = await encryptRecord(env, 'owner-a', 'customer', 'local-1', 1, { memo: '비밀' });
  await assert.rejects(() => decryptRecord(env, {
    owner_id: 'owner-b',
    entity_type: 'customer',
    entity_id: 'local-1',
    version: 1,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
  }), /확인하지 못했습니다/);
});

await check('phone search HMAC is deterministic and non-plaintext', async () => {
  const first = await phoneSearchHash(env, 'owner-a', 'customer', { primaryPhone: '010-1234-5678' });
  const second = await phoneSearchHash(env, 'owner-a', 'customer', { primaryPhone: '01012345678' });
  const otherOwner = await phoneSearchHash(env, 'owner-b', 'customer', { primaryPhone: '01012345678' });
  assert.equal(first, second);
  assert.notEqual(first, otherOwner);
  assert.equal(first.includes('01012345678'), false);
  assert.equal(first.length, 64);
});

const [migration, shared, push, pull, erase, roadmap] = await Promise.all([
  readFile(new URL('../migrations/0010_calltag_secure_sync.sql', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/calltag-sync/_shared.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/calltag-sync/push.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/calltag-sync/pull.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/calltag-sync/erase.js', import.meta.url), 'utf8'),
  readFile(new URL('../docs/CALLTAG_PLATFORM_SECURITY_AND_ROADMAP_KO.md', import.meta.url), 'utf8'),
]);

await check('migration includes encrypted records and security tables', async () => {
  for (const table of [
    'calltag_sync_devices',
    'calltag_sync_records',
    'calltag_sync_changes',
    'calltag_sync_rate_limits',
    'calltag_security_events',
  ]) assert.ok(migration.includes(table), `missing ${table}`);
  assert.ok(migration.includes('ciphertext TEXT NOT NULL'));
  assert.ok(migration.includes('phone_search_hash'));
});

await check('server derives owner from verified session', async () => {
  assert.ok(shared.includes('callSession(request, env, input)'));
  assert.equal(push.includes('body.ownerId'), false);
  assert.equal(pull.includes('searchParams.get(\'ownerId\')'), false);
  assert.ok(push.includes('WHERE owner_id = ? AND entity_type = ? AND entity_id = ?'));
  assert.ok(pull.includes('WHERE changes.owner_id = ?'));
  assert.ok(erase.includes('WHERE owner_id = ?'));
});

await check('sync endpoints require device and rate limits', async () => {
  assert.ok(shared.includes("request.headers.get('X-CallTag-Device')"));
  assert.ok(push.includes('assertRateLimit'));
  assert.ok(pull.includes('assertRateLimit'));
  assert.ok(erase.includes('assertRateLimit'));
});

await check('version conflict and tombstone contracts exist', async () => {
  assert.ok(push.includes('CALLTAG_SYNC_VERSION_CONFLICT'));
  assert.ok(push.includes('deleted_at'));
  assert.ok(push.includes("item.deleted ? 'delete' : 'upsert'"));
  assert.ok(pull.includes('const deleted = Boolean(row.deleted_at)'));
  assert.ok(pull.includes('payload: deleted ? null'));
});

await check('roadmap documents login billing recovery and prohibited data', async () => {
  for (const phrase of [
    'Google 로그인 완료 조건',
    '결제 완료 조건',
    '앱 삭제·기기 변경',
    'AES-256-GCM',
    '통화 녹음',
    'CALLTAG_SECURE_SYNC_ENABLED=1',
  ]) assert.ok(roadmap.includes(phrase), `missing ${phrase}`);
});

for (const [name, passed, error] of results) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) console.error(error?.stack || error);
}
const failed = results.filter(([, passed]) => !passed);
if (failed.length) process.exit(1);
console.log(`CallTag secure sync QA passed: ${results.length} checks`);

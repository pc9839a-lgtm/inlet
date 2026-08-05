import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [bootstrap, devices, retention, wrangler, document] = await Promise.all([
  readFile(new URL('functions/api/calltag-sync/bootstrap.js', root), 'utf8'),
  readFile(new URL('functions/api/calltag-sync/devices.js', root), 'utf8'),
  readFile(new URL('functions/api/calltag-sync/retention.js', root), 'utf8'),
  readFile(new URL('wrangler.jsonc', root), 'utf8'),
  readFile(new URL('docs/CALLTAG_SECURE_SYNC_P1_BOOTSTRAP_DEVICE_RETENTION_KO.md', root), 'utf8'),
]);

const checks = [];
function check(name, condition) {
  checks.push([name, Boolean(condition)]);
}

check(
  'bootstrap owner isolation',
  bootstrap.includes('WHERE owner_id = ?')
    && bootstrap.includes('session.ownerId')
    && !bootstrap.includes("searchParams.get('ownerId')")
    && !bootstrap.includes('body.ownerId'),
);
check(
  'bootstrap pages direct encrypted records',
  bootstrap.includes('FROM calltag_sync_records')
    && bootstrap.includes('ORDER BY entity_type ASC, entity_id ASC')
    && bootstrap.includes('limit + 1'),
);
check(
  'bootstrap decrypts active and preserves tombstones',
  bootstrap.includes('payload: deleted ? null : await decryptRecord')
    && bootstrap.includes('deleted: Boolean') === false
    && bootstrap.includes('const deleted = Boolean(row.deleted_at)'),
);
check(
  'bootstrap snapshot cursor catches concurrent changes',
  bootstrap.includes('snapshotCursor')
    && bootstrap.includes("endpoint: '/api/calltag-sync/pull'")
    && bootstrap.includes('cursor: snapshotCursor'),
);
check(
  'bootstrap is rate limited',
  bootstrap.includes("'bootstrap', 20, 60 * 60")
    && bootstrap.includes('secureSyncSession(request, env)'),
);

check(
  'device list is owner isolated',
  devices.includes('FROM calltag_sync_devices')
    && devices.includes('WHERE owner_id = ?')
    && devices.includes('session.ownerId'),
);
check(
  'device identity is opaque',
  devices.includes('deviceKey: String(row.device_hash')
    && !devices.includes('X-CallTag-Device:')
    && !devices.includes('rawDevice'),
);
check(
  'current device revoke is blocked',
  devices.includes('deviceKey === session.deviceHash')
    && devices.includes('CALLTAG_SYNC_CURRENT_DEVICE_REVOKE_BLOCKED'),
);
check(
  'remote revoke requires owner confirmation',
  devices.includes('REVOKE_CALLTAG_SYNC_DEVICE')
    && devices.includes('AND device_hash = ?')
    && devices.includes("AND revoked_at = ''"),
);
check(
  'device management is rate limited',
  devices.includes("'devices_list', 30, 60 * 60")
    && devices.includes("'device_revoke', 5, 60 * 60"),
);

check(
  'retention has independent disabled gate',
  retention.includes("CALLTAG_SYNC_RETENTION_ENABLED || '0'")
    && retention.includes('CALLTAG_SYNC_RETENTION_SECRET')
    && wrangler.includes('"CALLTAG_SYNC_RETENTION_ENABLED": "0"'),
);
check(
  'retention defaults to dry run and requires write confirmation',
  retention.includes('const dryRun = body.dryRun !== false')
    && retention.includes('PURGE_CALLTAG_OPERATIONAL_LOGS')
    && retention.includes('CALLTAG_SYNC_RETENTION_CONFIRMATION_REQUIRED'),
);
check(
  'retention only purges operational logs',
  retention.includes('DELETE FROM calltag_security_events')
    && retention.includes('DELETE FROM calltag_sync_rate_limits')
    && !retention.includes('DELETE FROM calltag_sync_records')
    && !retention.includes('DELETE FROM calltag_sync_changes')
    && !retention.includes('DELETE FROM calltag_sync_devices'),
);
check(
  'retention explicitly reports protected customer structures',
  retention.includes('customerRecordsTouched: false')
    && retention.includes('syncChangesTouched: false')
    && retention.includes('tombstonesTouched: false')
    && retention.includes('devicesTouched: false'),
);
check(
  'secure sync remains disabled by default',
  wrangler.includes('"CALLTAG_SECURE_SYNC_ENABLED": "0"'),
);

for (const phrase of [
  '재설치 전체 복구 bootstrap',
  '기기 목록과 원격 해제',
  '운영 로그 보관기간 정리',
  '오래된 기기가 삭제된 고객을 다시 업로드',
  'FULL_BOOTSTRAP_REQUIRED',
]) {
  check(`document contains ${phrase}`, document.includes(phrase));
}

await Promise.all([
  import('../functions/api/calltag-sync/bootstrap.js'),
  import('../functions/api/calltag-sync/devices.js'),
  import('../functions/api/calltag-sync/retention.js'),
]);
check('new endpoint modules import successfully', true);

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
}
if (failed.length) {
  throw new Error(`CallTag secure sync P1 QA failed: ${failed.map(([name]) => name).join(', ')}`);
}
console.log(`CallTag secure sync P1 QA passed: ${checks.length} checks`);

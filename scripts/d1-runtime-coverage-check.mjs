import {
  D1_RUNTIME_ROUTE_COVERAGE,
  createStorageRuntime,
  storageRuntimeCoverage,
  storageRuntimeHealth,
} from '../server/storage/runtimeAdapter.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fakeD1() {
  return {
    prepare() {
      return {
        bind() {
          return this;
        },
        async run() {
          return { success: true };
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
}

const requiredKeys = [
  'accounts',
  'pages',
  'leads',
  'eventsStats',
  'delivery',
  'aiDrafts',
  'invitesMembers',
  'ownershipTransfer',
  'aiKeys',
];

for (const key of requiredKeys) {
  assert(D1_RUNTIME_ROUTE_COVERAGE.some((item) => item.key === key), `coverage missing ${key}`);
}

for (const item of D1_RUNTIME_ROUTE_COVERAGE) {
  assert(item.label && item.routes?.length, `${item.key} must expose label and routes`);
  assert(['active', 'partial', 'jsonl'].includes(item.d1), `${item.key} has invalid D1 state`);
}

const missingRuntime = createStorageRuntime({ INLET_STORAGE_ADAPTER: 'd1' });
const missingHealth = storageRuntimeHealth(missingRuntime);
const missingCoverage = storageRuntimeCoverage(missingRuntime);

assert(missingHealth.requested === 'd1', 'missing runtime should report requested D1');
assert(missingHealth.active === 'jsonl' && missingHealth.fallback, 'missing D1 binding should fall back to JSONL');
assert(missingCoverage.length === D1_RUNTIME_ROUTE_COVERAGE.length, 'missing runtime coverage length mismatch');
assert(missingCoverage.every((item) => item.status === 'jsonl' && item.adapter === 'jsonl' && item.fallback), 'missing runtime should mark every route as JSONL fallback');

const readyRuntime = createStorageRuntime({ INLET_STORAGE_ADAPTER: 'auto', DB: fakeD1() });
const readyHealth = storageRuntimeHealth(readyRuntime);
const readyCoverage = storageRuntimeCoverage(readyRuntime);

assert(readyHealth.active === 'd1' && readyHealth.d1Ready && !readyHealth.fallback, 'ready runtime should report active D1');
assert(readyCoverage.find((item) => item.key === 'leads')?.status === 'active', 'leads should be active on D1 runtime');
assert(readyCoverage.find((item) => item.key === 'eventsStats')?.adapter === 'd1', 'stats should use D1 on D1 runtime');
assert(readyCoverage.find((item) => item.key === 'invitesMembers')?.status === 'partial', 'invite/member coverage should remain partial until access writes move to D1');
assert(readyCoverage.find((item) => item.key === 'aiKeys')?.status === 'jsonl', 'AI key vault should stay JSONL until the key storage migration is designed');
assert(readyCoverage.every((item) => Array.isArray(item.routes) && item.routes.length > 0), 'every coverage row should expose routes');

console.log(JSON.stringify({
  ok: true,
  checks: 24 + D1_RUNTIME_ROUTE_COVERAGE.length,
  requestedFallback: missingHealth,
  ready: readyHealth,
  activeD1Routes: readyCoverage.filter((item) => item.adapter === 'd1').length,
  jsonlRoutes: readyCoverage.filter((item) => item.adapter === 'jsonl').length,
}, null, 2));

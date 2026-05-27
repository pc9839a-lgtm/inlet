import { assertD1Binding, d1UnavailablePlan } from './d1Adapter.mjs';

const STORAGE_MODES = new Set(['jsonl', 'd1', 'auto']);

export function normalizeStorageMode(value = 'jsonl') {
  const mode = String(value || '').trim().toLowerCase();
  return STORAGE_MODES.has(mode) ? mode : 'jsonl';
}

export function detectD1Binding(env = {}) {
  return env.DB || env.INLET_D1 || env.d1 || null;
}

export function createStorageRuntime(env = {}) {
  const requested = normalizeStorageMode(env.INLET_STORAGE_ADAPTER || env.INLET_STORAGE_MODE || 'jsonl');
  const d1 = detectD1Binding(env);
  const d1Ready = (() => {
    try {
      assertD1Binding(d1);
      return true;
    } catch {
      return false;
    }
  })();
  const active = (requested === 'd1' || requested === 'auto') && d1Ready ? 'd1' : 'jsonl';
  return {
    requested,
    active,
    d1,
    d1Ready,
    fallback: requested === 'd1' && active !== 'd1',
    jsonlFallback: active === 'jsonl',
  };
}

export function storageRuntimeHealth(runtime = {}) {
  return {
    requested: runtime.requested || 'jsonl',
    active: runtime.active || 'jsonl',
    d1Ready: !!runtime.d1Ready,
    fallback: !!runtime.fallback,
  };
}

export function storageRuntimePlan(runtime = {}, type = 'records', filters = {}, extra = {}) {
  if (runtime.active === 'd1') {
    return {
      adapter: 'd1',
      indexed: true,
      fullScan: false,
      available: true,
      type,
      filters: { ...filters },
      activeIndexFields: Array.isArray(extra.activeIndexFields) ? extra.activeIndexFields : [],
      missingIndexFields: [],
      migrationPriority: extra.migrationPriority || 'runtime-d1',
      ...extra,
    };
  }
  if (runtime.requested === 'd1' && !runtime.d1Ready) {
    return d1UnavailablePlan(type, filters, {
      ...extra,
      migrationPriority: extra.migrationPriority || 'missing-runtime-binding',
    });
  }
  return null;
}


function envValue(key) {
  return String(import.meta.env?.[key] || '').trim();
}

function normalizeBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function envMs(key, fallback) {
  const value = Number(envValue(key));
  return Number.isFinite(value) && value > 0 ? Math.max(1000, value) : fallback;
}

const apiBaseUrl = normalizeBaseUrl(envValue('VITE_INLET_API_BASE') || envValue('VITE_API_BASE_URL'));
const mapEmbedBaseUrl = normalizeBaseUrl(
  envValue('VITE_INLET_MAP_EMBED_BASE')
    || (typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? `${location.origin}/embed` : 'https://map.inlet.page/embed'),
);
const leadIntegrationTimeoutMs = envMs('VITE_INLET_INTEGRATION_TIMEOUT_MS', 10000);

export const runtimeConfig = {
  apiBaseUrl,
  mapEmbedBaseUrl,
  googleMapsEmbedKey: envValue('VITE_GOOGLE_MAPS_EMBED_KEY'),
  apiToken: envValue('VITE_INLET_API_TOKEN') || envValue('VITE_API_TOKEN'),
  aiMode: envValue('VITE_INLET_AI_MODE') || (apiBaseUrl ? 'server' : 'client'),
  leadMode: envValue('VITE_INLET_LEAD_MODE') || 'local',
  pageMode: envValue('VITE_INLET_PAGE_MODE') || 'local',
  leadIntegrationTimeoutMs,
  customCodeJsEnabled: envValue('VITE_INLET_ENABLE_CUSTOM_CODE_JS') === '1',
  clientAiKeyStorageEnabled: envValue('VITE_INLET_ALLOW_CLIENT_AI_KEY_STORAGE') === '1',
  ownerAdminModeEnabled: envValue('VITE_INLET_ENABLE_OWNER_ADMIN_MODE') === '1',
};

export function isServerAiMode() {
  return runtimeConfig.aiMode === 'server';
}

export function isClientAiKeyStorageEnabled() {
  return runtimeConfig.clientAiKeyStorageEnabled;
}

export function isOwnerAdminModeEnabled() {
  return runtimeConfig.ownerAdminModeEnabled;
}

export function isServerLeadMode() {
  return runtimeConfig.leadMode === 'server';
}

export function isServerPageMode() {
  return runtimeConfig.pageMode === 'server';
}

export function runtimeApiUrl(path) {
  const safePath = String(path || '').startsWith('/') ? String(path || '') : `/${path || ''}`;
  return `${runtimeConfig.apiBaseUrl}${safePath}`;
}

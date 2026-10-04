import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repositorySource = await readFile('src/lib/pageDomainRepository.js', 'utf8');
const settingsSource = await readFile('src/panels/settings/CustomDomainSettingsSection.jsx', 'utf8');
const panelSource = await readFile('src/panels/SettingsPanel.jsx', 'utf8');
const bodySource = await readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8');
const primarySource = await readFile('src/panels/settings/SettingsPrimarySections.jsx', 'utf8');

for (const token of [
  "postJson('/api/domains/check'",
  "postJson('/api/domains/manage'",
  "projectAuthHeaders(context)",
  "projectContext(page, authUser)",
  "AUTH_SIGNED_SESSION_REQUIRED",
  "DOMAIN_PAGE_IDENTITY_REQUIRED",
]) {
  assert(repositorySource.includes(token), `domain repository contract missing: ${token}`);
}
assert(!repositorySource.includes('api.cloudflare.com'), 'browser repository must never call Cloudflare directly');
assert(!repositorySource.includes('INLET_CLOUDFLARE_API_TOKEN'), 'browser repository must never contain provider credentials');

for (const token of [
  'checkPageDomain',
  'verifyPageDomain',
  'detachPageDomain',
  'onSavePage',
  'pageWithDomain',
  '상태 확인',
]) {
  assert(settingsSource.includes(token), `domain settings workflow missing: ${token}`);
}

const connectStart = settingsSource.indexOf('const saveAndConnectDomain = async () => {');
const connectEnd = settingsSource.indexOf('const refreshDomainStatus = async () => {');
assert(connectStart >= 0 && connectEnd > connectStart, 'connect workflow block missing');
const connectBlock = settingsSource.slice(connectStart, connectEnd);
const checkIndex = connectBlock.indexOf('checkPageDomain(');
const saveIndex = connectBlock.indexOf('onSavePage(nextPage)');
const verifyIndex = connectBlock.indexOf('verifyPageDomain(');
assert(checkIndex >= 0 && saveIndex > checkIndex && verifyIndex > saveIndex, 'connect workflow must be check -> page save -> provider verify');

const detachStart = settingsSource.indexOf('const removeDomain = async () => {');
const detachEnd = settingsSource.indexOf('const copyDns = async () => {');
assert(detachStart >= 0 && detachEnd > detachStart, 'detach workflow block missing');
const detachBlock = settingsSource.slice(detachStart, detachEnd);
const providerDetachIndex = detachBlock.indexOf('detachPageDomain(');
const detachSaveIndex = detachBlock.indexOf('onSavePage(nextPage)');
assert(providerDetachIndex >= 0 && detachSaveIndex > providerDetachIndex, 'detach workflow must clean provider mapping before clearing saved page hostname');

assert(settingsSource.includes("setServerDomain(verified?.current"), 'provider state must render from canonical server response');
assert(settingsSource.includes("setDnsState(verified?.dns"), 'DNS result must render from server response');
assert(settingsSource.includes("providerSslStatus === 'active'"), 'SSL active state must surface in settings');

for (const [source, label] of [
  [panelSource, 'SettingsPanel'],
  [bodySource, 'SettingsPanelBody'],
  [primarySource, 'SettingsPrimarySections'],
]) {
  assert(source.includes('onSavePage'), `${label} must keep revision-safe save action in the domain prop chain`);
}
assert(primarySource.includes('<CustomDomainSettingsSection') && primarySource.includes('page={page}'), 'domain settings must receive the persisted page identity');
assert(bodySource.includes("id === 'domain' && (!ownerFinanceAccess || !projectSettingsWritable)"), 'custom-domain navigation must remain owner-only and writable-only');
assert(settingsSource.includes("typeof onSavePage !== 'function'"), 'domain connection must fail closed when revision-safe page save is unavailable');
assert(!settingsSource.includes("updateIntegrations('domain'"), 'domain workflow must not use a local-only integration save fallback');
assert(settingsSource.includes("const apexDomain = recordName === '@'"), 'domain settings must distinguish apex from subdomain DNS setup');
assert(settingsSource.includes("apexDomain ? '네임서버' : 'CNAME'"), 'apex domains must not be instructed to create a CNAME at @');
assert(settingsSource.includes('네임서버를 Cloudflare로 변경해야 합니다.'), 'apex domains must surface the Cloudflare nameserver requirement');

console.log(JSON.stringify({
  ok: true,
  connectOrder: ['availability-check', 'revision-safe-page-save', 'provider-verify'],
  detachOrder: ['provider-detach-idempotent', 'revision-safe-page-save'],
  providerCallsFromBrowser: false,
  protectedRootChanged: false,
}, null, 2));

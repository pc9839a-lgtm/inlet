import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const probe = await readFile('scripts/production-save-roundtrip-check.mjs', 'utf8');
const workflow = await readFile('.github/workflows/deploy-cloudflare.yml', 'utf8');
const qaAll = await readFile('scripts/qa-all.mjs', 'utf8');

assert(probe.includes("const QA_SLUG_PREFIX = 'qa-save-roundtrip-'"), 'production probe must use a dedicated QA slug prefix');
assert(probe.includes("baselinePages.length !== 0"), 'production probe must require the dedicated empty-page fixture');
assert(probe.includes("saveMode: 'create-new'") && probe.includes("saveMode: 'update-existing'"), 'production probe must exercise create and update save modes');
assert(probe.includes("authenticated-readback") && probe.includes("public-readback"), 'production probe must verify authenticated and public D1 readback');
assert(probe.includes('deleteQaPage') && probe.includes('baselineRestored'), 'production probe must clean up and verify fixture restoration');
assert(probe.includes("if (!slug.startsWith(QA_SLUG_PREFIX)"), 'cleanup must refuse non-QA page deletion');
assert(!probe.includes("'dyjh'") && !probe.includes('"dyjh"'), 'production probe must never target the live dyjh page');
assert(probe.includes('configuredOrigins.includes(baseUrl)') && probe.includes("url.protocol !== 'https:'"), 'production probe must enforce approved HTTPS origins');
assert(probe.includes('user.platformMaster') && probe.includes('refuses platform-master fixture'), 'production probe must refuse platform-master credentials');
assert(workflow.includes('production-save-roundtrip:') && workflow.includes('needs: deploy'), 'Cloudflare workflow must run production save verification only after deploy');
assert(workflow.includes('environment: production'), 'production save verification must use the protected production environment');
assert(workflow.includes('PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION'), 'production save verification must reuse the dedicated empty-page fixture session');
assert(workflow.includes('PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS'), 'production save verification must use the approved production origin allowlist');
assert(workflow.includes('node scripts/production-save-roundtrip-check.mjs'), 'Cloudflare workflow must execute the production save roundtrip probe');
assert(qaAll.includes("production:save:roundtrip:contract:qa"), 'offline release gate must protect the production save probe contract');

console.log(JSON.stringify({
  ok: true,
  checks: 15,
  protections: {
    disposablePrefixOnly: true,
    emptyFixtureRequired: true,
    createUpdateReadDelete: true,
    baselineRestorationRequired: true,
    productionEnvironmentRequired: true,
  },
}, null, 2));

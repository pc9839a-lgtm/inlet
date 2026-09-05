import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const probe = await readFile('scripts/production-save-roundtrip-check.mjs', 'utf8');
const endpoint = await readFile('functions/api/qa/production-save-session.js', 'utf8');
const workflow = await readFile('.github/workflows/deploy-cloudflare.yml', 'utf8');
const qaAll = await readFile('scripts/qa-all.mjs', 'utf8');

assert(probe.includes("const QA_SLUG_PREFIX = 'qa-save-roundtrip-'"), 'production probe must use a dedicated QA slug prefix');
assert(probe.includes('productionQaSecret') && probe.includes('/api/qa/production-save-session'), 'production probe must mint an ephemeral QA session when no static fixture session exists');
assert(probe.includes("'X-Inlet-Production-QA-Secret': productionQaSecret"), 'production probe must send the rotating QA credential only in the dedicated header');
assert(probe.includes("baselinePages.length !== 0"), 'production probe must require the dedicated empty-page fixture');
assert(probe.includes("saveMode: 'create-new'") && probe.includes("saveMode: 'update-existing'"), 'production probe must exercise create and update save modes');
assert(probe.includes("authenticated-readback") && probe.includes("public-readback"), 'production probe must verify authenticated and public D1 readback');
assert(probe.includes('deleteQaPage') && probe.includes('baselineRestored'), 'production probe must clean up and verify fixture restoration');
assert(probe.includes("if (!slug.startsWith(QA_SLUG_PREFIX)"), 'cleanup must refuse non-QA page deletion');
assert(!probe.includes("'dyjh'") && !probe.includes('"dyjh"'), 'production probe must never target the live dyjh page');
assert(probe.includes('configuredOrigins.includes(baseUrl)') && probe.includes("url.protocol !== 'https:'"), 'production probe must enforce approved HTTPS origins');
assert(probe.includes('user.platformMaster') && probe.includes('refuses platform-master fixture'), 'production probe must refuse platform-master credentials');
assert(probe.includes('embeddedQaImage') && probe.includes('pageAssets.replaced') && probe.includes("savedImage.startsWith('/api/files/download?key=')"), 'production probe must verify live R2 image externalization through the normal save route');
assert(probe.includes('hardCleanupQaProject') && probe.includes("body: { action: 'cleanup', projectId }"), 'production probe must hard-clean isolated QA D1/R2 residue after normal route cleanup');

assert(endpoint.includes("const QA_HOST = 'pagero.kr'"), 'QA session endpoint must be pinned to pagero.kr');
assert(endpoint.includes('INLET_PRODUCTION_QA_SECRET') && endpoint.includes('X-Inlet-Production-QA-Secret'), 'QA session endpoint must require the rotating production QA secret');
assert(endpoint.includes('expected.length >= 64') && endpoint.includes('provided.length >= 64') && endpoint.includes('constantTimeEqual'), 'QA credential comparison must require strong material and constant-time comparison');
assert(endpoint.includes("return jsonResponse(request, env, 404"), 'unauthorized QA session requests must be concealed as not found');
assert(endpoint.includes('upsertD1Account') && endpoint.includes('createSessionToken'), 'QA endpoint must mint an ordinary signed session for a dedicated D1 account');
assert(endpoint.includes('QA_PROJECT_PREFIX') && endpoint.includes("DELETE FROM page_revisions WHERE project_id = ?") && endpoint.includes("DELETE FROM pages WHERE project_id = ?"), 'QA hard cleanup must be restricted to the dedicated project prefix');
assert(endpoint.includes("prefix: `${assetProjectId}/images/`") && endpoint.includes('await bucket.delete(keys)'), 'QA hard cleanup must remove only its R2 page-image prefix');
assert(endpoint.includes("owner_account_id = ?") && endpoint.includes('QA_ACCOUNT_ID'), 'QA project hard deletion must require fixture ownership');
assert(endpoint.includes("QA_EMAIL = 'production-save-qa@pagero.invalid'"), 'QA endpoint must use a reserved non-user email fixture');
assert(endpoint.includes('platformMaster: false') && endpoint.includes('secretValuesIncluded: false'), 'QA endpoint must remain non-admin and must never return secret values');

assert(workflow.includes('Rotate production save QA secret'), 'deployment must rotate a dedicated QA credential every production deploy');
assert(workflow.includes('openssl rand -hex 64') && workflow.includes('::add-mask::$qa_secret'), 'deployment QA credential must be 512-bit random material and immediately masked');
assert(workflow.includes('wrangler pages secret put INLET_PRODUCTION_QA_SECRET --project-name inlet'), 'deployment must bind the rotating QA credential as a Pages secret');
assert(workflow.includes('INLET_PRODUCTION_SAVE_QA_SECRET=$qa_secret') && workflow.includes('$GITHUB_ENV'), 'live probe must receive the current QA credential only inside the deployment job');
assert(workflow.includes("id: production_save") && workflow.includes("if: steps.readiness.outcome == 'success'"), 'live save must run in the same deploy job after readiness');
assert(workflow.includes('PAGERO_PRODUCTION_SAVE_ALLOWED_ORIGINS: https://pagero.kr'), 'production save verification must pin its approved origin to pagero.kr');
assert(workflow.includes('node scripts/production-save-roundtrip-check.mjs'), 'deployment must execute the live production save probe');
assert(workflow.includes('production_save_roundtrip_failed'), 'live save failure must fail the production deployment');
assert(workflow.includes("steps.production_save.outcome != 'success'"), 'final deployment gate must require a successful live save');
assert(workflow.includes('if-no-files-found: error'), 'production save evidence artifact must be required when the probe runs');
assert(!workflow.includes('\n  production-save-roundtrip:'), 'live save must not depend on a separate job that loses the rotating credential');
assert(!workflow.includes('fixture-session-missing'), 'production deploy must not silently skip live save because a static fixture session is missing');
assert(!workflow.includes('PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION'), 'production live save must not depend on a long-lived user session secret');
assert(qaAll.includes("production:save:roundtrip:contract:qa"), 'offline release gate must protect the production save probe contract');

console.log(JSON.stringify({
  ok: true,
  checks: 37,
  protections: {
    disposablePrefixOnly: true,
    rotatingQaCredential: true,
    credentialBits: 512,
    credentialMasked: true,
    productionHostPinned: true,
    concealedUnauthorizedEndpoint: true,
    ordinarySignedSession: true,
    platformMasterBlocked: true,
    createUpdateReadDelete: true,
    liveR2Externalization: true,
    baselineRestorationRequired: true,
    d1ResiduePurged: true,
    r2ResiduePurged: true,
    noStaticFixtureSessionDependency: true,
    liveSaveDeploymentGate: true,
  },
}, null, 2));

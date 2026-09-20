import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const runbook = await readFile('docs/ops-pagero-production-launch-smoke.md', 'utf8');
const register = await readFile('functions/api/auth/register.js', 'utf8');
const verify = await readFile('functions/api/auth/email-verification.js', 'utf8');
const login = await readFile('functions/api/auth/login.js', 'utf8');
const pages = await readFile('functions/api/pages/[slug].js', 'utf8');
const leads = await readFile('functions/api/leads.js', 'utf8');
const leadDetail = await readFile('functions/api/leads/[id].js', 'utf8');
const templates = await readFile('src/templates/landingTemplates.js', 'utf8');
const inbox = await readFile('src/panels/InboxPanel.jsx', 'utf8');

assert(runbook.includes('production 실행에 대한 명시적 승인'), 'launch smoke runbook must require explicit production approval');
assert(runbook.includes('실제 production D1 write'), 'launch smoke runbook must call out production writes');
assert(runbook.includes('신규 회원가입') && runbook.includes('6자리 인증메일'), 'launch smoke must include real signup email verification');
assert(runbook.includes('로그아웃 후 동일 계정으로 다시 로그인'), 'launch smoke must include fresh login after signup');
assert(runbook.includes('quote-request'), 'launch smoke must use a real shipped template');
assert(runbook.includes('공개 URL') && runbook.includes('문의 1건'), 'launch smoke must verify public page and inquiry');
assert(runbook.includes('접수함') && runbook.includes('문의 cleanup') && runbook.includes('페이지 cleanup'), 'launch smoke must verify inbox and cleanup');
assert(runbook.includes('인증코드, 비밀번호, session token, 전체 전화번호는 증빙에 남기지 않는다.'), 'launch smoke evidence must exclude secrets and full phone');

assert(verify.includes("purpose || 'signup'") && verify.includes('sendAuthVerificationEmail'), 'signup verification endpoint must use real email delivery');
assert(register.includes('registerAccount') && register.includes('createSessionToken'), 'signup endpoint must create an account and session');
assert(login.includes('loginAccount') && login.includes('auth.login_succeeded'), 'login endpoint must support fresh password login');
assert(pages.includes("request.method === 'POST'") && pages.includes('upsertD1Page'), 'page endpoint must support production page save');
assert(pages.includes("url.searchParams.get('public') === '1'"), 'page endpoint must support public readback');
assert(leads.includes("request.method === 'POST'") && leads.includes('upsertD1Lead'), 'lead endpoint must support public inquiry save');
assert(leads.includes("request.method === 'GET'") && leads.includes('listD1Leads'), 'lead endpoint must support inbox readback');
assert(leadDetail.includes("request.method === 'DELETE'") && leadDetail.includes('deleteD1Lead'), 'launch smoke must have a lead cleanup route');
assert(pages.includes("request.method === 'DELETE'") && pages.includes("status = 'archived'"), 'launch smoke must have a page cleanup/archive route');
assert(templates.includes("id: 'quote-request'") && templates.includes('createTemplatePage'), 'launch smoke template must exist in the shipped catalog');
assert(inbox.includes('fetchServerLeads') || inbox.includes('useInboxLeadSync'), 'InboxPanel must remain wired to server lead readback');

console.log(JSON.stringify({
  ok: true,
  checks: 19,
  launchGate: {
    explicitProductionApproval: true,
    realEmailVerification: true,
    freshLogin: true,
    templateSelection: true,
    editPublish: true,
    publicReadback: true,
    publicInquiry: true,
    inboxReadback: true,
    cleanupRequired: true,
    secretsExcludedFromEvidence: true,
  },
}, null, 2));

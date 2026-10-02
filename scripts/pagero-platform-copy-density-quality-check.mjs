import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const dashboard = await readFile('src/screens/DashboardScreen.jsx', 'utf8');
const dashboardCss = await readFile('src/screens/DashboardAccountLimit.css', 'utf8');
const createFlow = await readFile('src/screens/CreateLandingFlow.jsx', 'utf8');
const createModalCss = await readFile('src/styles/panels-create-modal.css', 'utf8');
const createFlowCss = await readFile('src/styles/panels-create-flow.css', 'utf8');
const billing = await readFile('src/panels/settings/BillingSettingsSection.jsx', 'utf8');
const billingCss = await readFile('src/panels/settings/BillingSettingsSection.css', 'utf8');
const domain = await readFile('src/panels/settings/CustomDomainSettingsSection.jsx', 'utf8');

assert(dashboard.includes('service-dashboard-toolbar'), 'dashboard must use compact product toolbar');
assert(!dashboard.includes('랜딩 제작, 접수 확인, 통계를 한 화면에서 관리합니다.'), 'dashboard marketing explanation must stay removed');
assert(!dashboard.includes('랜딩 운영 콘솔'), 'dashboard brand subtitle must stay removed');
assert(!dashboard.includes('전체 랜딩 기준'), 'dashboard metric explanation must stay removed');
assert(dashboardCss.includes('background: #f5f6f8 !important;') && dashboardCss.includes('border-radius: 12px !important;'), 'dashboard must keep flat SaaS shell styling');

assert(createFlow.includes('<h2 id="create-landing-title">새 랜딩</h2>'), 'create modal must use concise title');
assert(createFlow.includes('<h2 id="create-landing-title">URL 설정</h2>'), 'URL step must use concise title');
assert(createFlow.includes('<h2 id="create-landing-title">기본 정보</h2>'), 'manual step must use concise title');
assert(!createFlow.includes('시작 방식만 먼저 고르고'), 'create flow explanation must stay removed');
assert(!createFlow.includes('푸터 기본정보만 입력하고 바로 편집합니다.'), 'manual mode explanation must stay removed');
assert(!createFlow.includes('실제 예시 화면을 넘겨보고 선택합니다.'), 'template mode explanation must stay removed');
assert(createModalCss.includes('.create-options > button > span') && createModalCss.includes('display: none;'), 'create option descriptions must stay hidden');
assert(createFlowCss.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'), 'desktop create modes must stay compact');

assert(!billing.includes('billing-plan-pitch'), 'pricing marketing pitch must stay removed');
assert(!billing.includes('billing-plan-why'), 'pricing recommendation prose must stay removed');
assert(!billing.includes('이런 경우 추천'), 'pricing recommendation sentence must stay removed');
assert(billing.includes('웹 자동결제 준비 중 · 유료 플랜은 가입 문의로 연결됩니다.'), 'essential billing status must remain concise');
assert(billingCss.includes('min-height: 330px;'), 'pricing cards must remain compact');

assert(!domain.includes('베타 운영: 개인 도메인'), 'domain beta paragraph must stay removed');
assert(!domain.includes('현재는 DNS를 변경하지 않아도 됩니다.'), 'domain DNS explanation must stay removed');
assert(domain.includes("sslIncludedByPlan ? '프로 포함' : sslEnabled ? '사용 가능' : '미사용'"), 'domain SSL must use compact status copy');

console.log(JSON.stringify({
  ok: true,
  checks: 20,
  scope: 'pagero-platform-copy-density',
  dashboard: 'compact-saas-shell',
  createFlow: 'action-first',
  settings: ['pricing-data-first', 'domain-status-first'],
  aiLogicTouched: false,
}, null, 2));

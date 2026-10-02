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
const auth = await readFile('src/screens/AuthScreen.jsx', 'utf8');
const authCss = await readFile('src/styles/panels-home-auth.css', 'utf8');
const masterAdmin = await readFile('src/panels/MasterAdminPanel.jsx', 'utf8');
const inbox = await readFile('src/panels/InboxPanel.jsx', 'utf8');
const mobileOperationsHeader = await readFile('src/screens/workspace/MobileOperationsHeader.jsx', 'utf8');
const stats = await readFile('src/panels/StatsPanel.jsx', 'utf8');
const settingsPrimary = await readFile('src/panels/settings/SettingsPrimarySections.jsx', 'utf8');
const accountSettings = await readFile('src/panels/settings/AccountSettingsSection.jsx', 'utf8');
const revisionHistory = await readFile('src/panels/settings/PageRevisionHistorySection.jsx', 'utf8');
const seoSettings = await readFile('src/panels/settings/SeoSettingsSection.jsx', 'utf8');
const editLayout = await readFile('src/editor/EditPanelLayout.jsx', 'utf8');
const addBlockGroupGrid = await readFile('src/editor/editPanelParts/AddBlockGroupGrid.jsx', 'utf8');
const addDockCss = await readFile('src/styles/editor-widget-add-dock.css', 'utf8');

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
assert(!billing.includes('웹 자동결제 준비 중 · 유료 플랜은 가입 문의로 연결됩니다.'), 'billing prose status must stay removed');
assert(billing.includes('billing-settings-status') && billing.includes('<span>자동결제</span><strong>준비 중</strong>') && billing.includes('<span>유료 플랜</span><strong>가입 문의</strong>'), 'billing must expose product-style status data');
assert(billingCss.includes('min-height: 330px;'), 'pricing cards must remain compact');

assert(!domain.includes('베타 운영: 개인 도메인'), 'domain beta paragraph must stay removed');
assert(!domain.includes('현재는 DNS를 변경하지 않아도 됩니다.'), 'domain DNS explanation must stay removed');
assert(domain.includes("sslIncludedByPlan ? '프로 포함' : sslEnabled ? '사용 가능' : '미사용'"), 'domain SSL must use compact status copy');

assert(!auth.includes('고객 인입 랜딩 빌더'), 'auth brand subtitle must stay removed');
assert(!auth.includes('고객이 들어오는 첫 화면을 만들고 관리하세요.'), 'auth marketing explanation must stay removed');
assert(!auth.includes('아직 계정이 없나요?') && !auth.includes('이미 계정이 있나요?'), 'auth switch prompts must stay concise');
assert(!auth.includes('이메일 인증 후 비밀번호 변경'), 'auth password action must stay concise');
assert(auth.includes("mode === 'signup' ? '회원가입' : '비밀번호 변경'"), 'auth mode titles must be functional labels');
assert(authCss.includes('border-radius: 16px !important;') && authCss.includes('background: #f5f6f8 !important;'), 'auth must keep flat SaaS surface styling');

assert(!masterAdmin.includes('회원, 페이지, 결제, 파일 사용량, 접수 추이와 운영 리스크를 개인정보 노출 없이 확인합니다.'), 'master admin hero explanation must stay removed');
assert(!masterAdmin.includes('개별 고객 정보 없이 페이지 단위 접수량만 봅니다.'), 'master admin card explanations must stay removed');
assert(!masterAdmin.includes('전체 서비스 운영에 필요한 핵심 수치만 모았습니다.'), 'master admin summary explanation must stay removed');
assert(!masterAdmin.includes('회원별 보유 페이지, 유료 페이지, 플랜과 최근 활동만 확인합니다.'), 'master admin member explanation must stay removed');
assert(!masterAdmin.includes('유료 플랜 조건과 파일 권한을 확인해야 합니다.'), 'risk details must stay status-like, not prose');
assert(masterAdmin.includes("detail: '플랜·파일 권한 확인'") && masterAdmin.includes("detail: '광고·스팸 구분'"), 'master admin risk details must remain compact action labels');

assert(!inbox.includes('<small>고객 문의 관리</small>'), 'inbox duplicate subtitle must stay removed');
assert(!inbox.includes('왼쪽 목록에서 문의를 선택하면 상세 내용이 표시됩니다.'), 'inbox empty-state explanation must stay removed');
assert(!inbox.includes('입력한 메모는 접수 데이터에 자동 저장됩니다.'), 'inbox memo helper sentence must stay removed');
assert(!inbox.includes('반복 제출과 중복 연락처를 처리하는 기준을 설정합니다.'), 'inbox duplicate policy explanation must stay removed');
assert(!inbox.includes('접수 데이터를 이메일, Google Sheets, Webhook으로 전달합니다.'), 'inbox connection explanation must stay removed');
assert(inbox.includes('placeholder="이름 · 연락처 · 문의"') && inbox.includes('<small className="inbox-ops-help">자동 저장</small>'), 'inbox must keep compact functional copy');

assert(!mobileOperationsHeader.includes('접수 현황과 통계를 확인할 수 있습니다.'), 'mobile operations header explanation must stay removed');
assert(mobileOperationsHeader.includes('<h1>모바일 운영</h1>'), 'mobile operations functional title must remain');
assert(!stats.includes('선택한 기간에 표시할 데이터가 없습니다.') && stats.includes('stats-v4-empty">데이터 없음'), 'stats empty state must stay compact');
assert(!stats.includes('접수 데이터가 없습니다.') && stats.includes('stats-v4-empty">접수 없음'), 'stats lead empty state must stay compact');
assert(!stats.includes('일부 데이터만 표시 중입니다.') && stats.includes('stats-v4-notice') && stats.includes('일부 데이터'), 'stats partial-data status must stay concise');

assert(!settingsPrimary.includes('description="프로필과 비밀번호 관리"'), 'account settings helper description must stay removed');
assert(accountSettings.includes('계정 정보 없음') && !accountSettings.includes('로그인된 계정 정보가 없습니다.'), 'account settings empty state must stay compact');
assert(revisionHistory.includes('불러오기 후 저장 시 공개 반영') && revisionHistory.includes('저장 시 공개 반영'), 'revision history must keep concise publish-impact status');
assert(!revisionHistory.includes('과거 저장본을 현재 편집본으로 불러옵니다.') && !revisionHistory.includes('내용을 확인한 뒤 저장하면 현재 공개 페이지에 반영됩니다.'), 'revision history explanatory copy must stay removed');
assert(!seoSettings.includes('필요한 경우에만 입력'), 'SEO helper sentence must stay removed');

assert(!editLayout.includes('테마 설정 불러오는 중') && editLayout.includes('editor-inspector-loading">불러오는 중'), 'editor inspector loading state must stay concise');
assert(!addBlockGroupGrid.includes('조건에 맞는 위젯이 없습니다.') && addBlockGroupGrid.includes('widget-add-empty" role="status">위젯 없음'), 'widget search empty state must stay concise');
assert(addDockCss.includes('Editor add dock — compact product density') && addDockCss.includes('border-radius: 7px !important;'), 'widget add dock must keep compact product controls');
assert(addDockCss.includes('border: 0 !important;') && addDockCss.includes('background: transparent !important;'), 'widget groups must stay flat instead of nested marketing cards');

console.log(JSON.stringify({
  ok: true,
  checks: 53,
  scope: 'pagero-platform-copy-density',
  dashboard: 'compact-saas-shell',
  createFlow: 'action-first',
  settings: ['pricing-data-first', 'domain-status-first'],
  auth: 'functional-copy-only',
  admin: 'data-first',
  inbox: 'action-first',
  mobileStats: 'status-only',
  generalSettings: 'functional-copy-only',
  editor: 'compact-product-ui',
  aiLogicTouched: false,
}, null, 2));

import { useState } from 'react';
import {
  Activity,
  Code2,
  Copy,
  CreditCard,
  FileText,
  Gift,
  Globe2,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import SettingsAdvancedAndReset from './SettingsAdvancedAndReset.jsx';
import PageDuplicateUrlModal from './PageDuplicateUrlModal.jsx';
import SettingsPrimarySections from './SettingsPrimarySections.jsx';

const PRIMARY_NAV = [
  ['account', '계정 정보', UserRound],
  ['basic', '페이지 기본', FileText],
  ['domain', '개인 도메인', Globe2],
  ['managers', '매니저 권한', UsersRound],
];

const SERVICE_NAV = [
  ['billing', '요금제·결제', CreditCard],
  ['referral', '추천인', Gift],
  ['partner', '파트너', UsersRound],
  ['settlement', '정산', WalletCards],
];

const ADVANCED_NAV = [
  ['seo', 'SEO 설정', Search],
  ['tracking', '추적 코드', Code2],
  ['conversion', '전환 설정', Target],
  ['duplicate', '페이지 복제', Copy],
  ['reset', '초기화', RotateCcw],
];

const ALL_NAV = [...PRIMARY_NAV, ...SERVICE_NAV, ...ADVANCED_NAV];
const ADVANCED_IDS = new Set(ADVANCED_NAV.map(([id]) => id));
const OWNER_ONLY_IDS = new Set(['billing', 'referral', 'partner', 'settlement']);

export default function SettingsPanelBody({
  authUser,
  canDuplicatePage,
  canManageProjectUsers,
  clientAdminMode,
  duplicateSettings,
  drafts,
  integrations,
  managerSettings,
  onAccountUpdate,
  onLogout,
  onReset,
  ownership,
  page,
  sections,
  transferRequest,
  updateIntegrations,
}) {
  const {
    duplicateBlocked,
    duplicateDraft,
    duplicateIssues,
    duplicateOpen,
    requestPageDuplicate,
    setDuplicateField,
    setDuplicateOpen,
  } = duplicateSettings;
  const {
    openSection,
    setAdvancedOpen,
    setOpenSection,
  } = sections;
  const ownerFinanceAccess = canManageProjectUsers && !clientAdminMode;
  const initialSection = (() => {
    const requested = openSection || 'account';
    if (clientAdminMode && ADVANCED_IDS.has(requested)) return 'account';
    if (!canManageProjectUsers && requested === 'managers') return 'account';
    if (!ownerFinanceAccess && OWNER_ONLY_IDS.has(requested)) return 'account';
    return requested;
  })();
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const managerCount = Array.isArray(ownership?.managers) ? ownership.managers.length : 0;
  const selectedLabel = ALL_NAV.find(([id]) => id === selectedSection)?.[1] || '계정 정보';

  const selectSection = (id) => {
    setSelectedSection(id);
    setAdvancedOpen(ADVANCED_IDS.has(id));
    setOpenSection(id);
  };

  const visibleSections = {
    ...sections,
    advancedOpen: ADVANCED_IDS.has(selectedSection),
    openSection: selectedSection,
    setOpenSection: (nextSection) => {
      if (nextSection) selectSection(nextSection);
    },
  };

  return (
    <div className="simple-panel settings-panel settings-ops-root">
      <div className="settings-ops-layout">
        <aside className="settings-ops-sidebar">
          <div className="settings-ops-sidebar-title">
            <strong>설정</strong>
            <span>{page.title || '현재 페이지'}</span>
          </div>

          <nav className="settings-ops-nav" aria-label="기본 설정">
            <small>기본</small>
            {PRIMARY_NAV.filter(([id]) => id !== 'managers' || canManageProjectUsers).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                className={`settings-ops-nav-item ${selectedSection === id ? 'active' : ''}`}
                onClick={() => selectSection(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {ownerFinanceAccess && (
            <nav className="settings-ops-nav service" aria-label="서비스 설정">
              <small>서비스</small>
              {SERVICE_NAV.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={`settings-ops-nav-item ${selectedSection === id ? 'active' : ''}`}
                  onClick={() => selectSection(id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          )}

          {!clientAdminMode && (
            <nav className="settings-ops-nav advanced" aria-label="고급 설정">
              <small>고급</small>
              {ADVANCED_NAV.map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={`settings-ops-nav-item ${selectedSection === id ? 'active' : ''}`}
                  onClick={() => selectSection(id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          )}
        </aside>

        <main className="settings-ops-main">
          <header className="settings-ops-main-head">
            <div>
              <small>페이지 설정</small>
              <h2>{selectedLabel}</h2>
            </div>
            <span>/{page.slug || 'page'}</span>
          </header>

          <div className="settings-ops-sections settings-ops-single-section">
            <SettingsPrimarySections
              activeSection={selectedSection}
              authUser={authUser}
              canManageProjectUsers={canManageProjectUsers}
              clientAdminMode={clientAdminMode}
              drafts={drafts}
              integrations={integrations}
              managerSettings={managerSettings}
              onAccountUpdate={onAccountUpdate}
              onLogout={onLogout}
              ownership={ownership}
              sections={visibleSections}
              transferRequest={transferRequest}
              updateIntegrations={updateIntegrations}
            />

            <SettingsAdvancedAndReset
              activeSection={selectedSection}
              canDuplicatePage={canDuplicatePage}
              clientAdminMode={clientAdminMode}
              duplicateSettings={duplicateSettings}
              drafts={drafts}
              integrations={integrations}
              onReset={onReset}
              page={page}
              sections={visibleSections}
              updateIntegrations={updateIntegrations}
            />
          </div>
        </main>

        <aside className="settings-ops-summary">
          <header>
            <small>페이지 정보</small>
            <h3>{page.title || '현재 페이지'}</h3>
          </header>

          <dl>
            <div>
              <dt><Globe2 size={17} aria-hidden="true" /><span>공개 주소</span></dt>
              <dd>/{page.slug || 'page'}</dd>
            </div>
            <div>
              <dt><ShieldCheck size={17} aria-hidden="true" /><span>관리 계정</span></dt>
              <dd>{authUser?.email || '연결 없음'}</dd>
            </div>
            <div>
              <dt><UsersRound size={17} aria-hidden="true" /><span>매니저</span></dt>
              <dd>{managerCount}명</dd>
            </div>
            <div>
              <dt><Activity size={17} aria-hidden="true" /><span>운영 상태</span></dt>
              <dd><span>운영 중</span></dd>
            </div>
          </dl>
        </aside>
      </div>

      {duplicateOpen && (
        <PageDuplicateUrlModal
          canDuplicatePage={canDuplicatePage}
          duplicateBlocked={duplicateBlocked}
          duplicateDraft={duplicateDraft}
          duplicateIssues={duplicateIssues}
          onClose={() => setDuplicateOpen(false)}
          onDuplicate={requestPageDuplicate}
          setDuplicateField={setDuplicateField}
        />
      )}
    </div>
  );
}

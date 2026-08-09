import { useState } from 'react';
import {
  Code2,
  Copy,
  CreditCard,
  FileText,
  Gift,
  Globe2,
  RotateCcw,
  Search,
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

function SettingsNavGroup({ label, items, selectedSection, selectSection }) {
  return (
    <nav className="settings-nav-group" aria-label={`${label} 설정`}>
      <span className="settings-nav-label">{label}</span>
      <div className="settings-nav-items">
        {items.map(([id, itemLabel, Icon]) => (
          <button
            key={id}
            type="button"
            className={`settings-nav-item ${selectedSection === id ? 'active' : ''}`}
            onClick={() => selectSection(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{itemLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

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
  const { openSection, setAdvancedOpen, setOpenSection } = sections;
  const ownerFinanceAccess = canManageProjectUsers && !clientAdminMode;
  const initialSection = (() => {
    const requested = openSection || 'account';
    if (clientAdminMode && ADVANCED_IDS.has(requested)) return 'account';
    if (!canManageProjectUsers && requested === 'managers') return 'account';
    if (!ownerFinanceAccess && OWNER_ONLY_IDS.has(requested)) return 'account';
    return requested;
  })();
  const [selectedSection, setSelectedSection] = useState(initialSection);
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

  const primaryItems = PRIMARY_NAV.filter(([id]) => id !== 'managers' || canManageProjectUsers);

  return (
    <div className="settings-v3-root settings-v4-flat">
      <aside className="settings-v3-sidebar">
        <SettingsNavGroup label="기본" items={primaryItems} selectedSection={selectedSection} selectSection={selectSection} />
        {ownerFinanceAccess && (
          <SettingsNavGroup label="서비스" items={SERVICE_NAV} selectedSection={selectedSection} selectSection={selectSection} />
        )}
        {!clientAdminMode && (
          <SettingsNavGroup label="고급" items={ADVANCED_NAV} selectedSection={selectedSection} selectSection={selectSection} />
        )}
      </aside>

      <main className="settings-v3-main">
        <div className="settings-v3-content-wrap">
          <header className="settings-page-head settings-page-head-compact">
            <h1>{selectedLabel}</h1>
          </header>

          <div className="settings-v3-content">
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
        </div>
      </main>

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

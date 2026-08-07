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
  ['account', '계정', UserRound],
  ['basic', '기본 정보', FileText],
  ['domain', '개인 도메인', Globe2],
  ['managers', '매니저', UsersRound],
];

const SERVICE_NAV = [
  ['billing', '요금제·결제', CreditCard],
  ['referral', '추천인', Gift],
  ['partner', '파트너', UsersRound],
  ['settlement', '정산', WalletCards],
];

const ADVANCED_NAV = [
  ['seo', 'SEO', Search],
  ['tracking', '추적 코드', Code2],
  ['conversion', '전환 설정', Target],
  ['duplicate', '페이지 복제', Copy],
  ['reset', '초기화', RotateCcw],
];

const ALL_NAV = [...PRIMARY_NAV, ...SERVICE_NAV, ...ADVANCED_NAV];
const ADVANCED_IDS = new Set(ADVANCED_NAV.map(([id]) => id));
const OWNER_ONLY_IDS = new Set(['billing', 'referral', 'partner', 'settlement']);

function SettingsNavGroup({ label, items, selectedSection, selectSection }) {
  if (!items.length) return null;
  return (
    <nav className="settings-ops-nav" aria-label={`${label} 설정`}>
      <small>{label}</small>
      <div className="settings-ops-nav-list">
        {items.map(([id, itemLabel, Icon]) => (
          <button
            key={id}
            type="button"
            className={`settings-ops-nav-item ${selectedSection === id ? 'active' : ''}`}
            onClick={() => selectSection(id)}
          >
            <Icon size={17} aria-hidden="true" />
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
  const selectedLabel = ALL_NAV.find(([id]) => id === selectedSection)?.[1] || '계정';

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
  const serviceItems = ownerFinanceAccess ? SERVICE_NAV : [];
  const advancedItems = clientAdminMode ? [] : ADVANCED_NAV;

  return (
    <div className="simple-panel settings-panel settings-ops-root settings-ops-v2">
      <div className="settings-ops-layout">
        <aside className="settings-ops-sidebar">
          <div className="settings-ops-sidebar-title">
            <strong>설정</strong>
            <span>{page.title || '현재 페이지'}</span>
          </div>

          <SettingsNavGroup
            label="페이지"
            items={primaryItems}
            selectedSection={selectedSection}
            selectSection={selectSection}
          />
          <SettingsNavGroup
            label="서비스"
            items={serviceItems}
            selectedSection={selectedSection}
            selectSection={selectSection}
          />
          <SettingsNavGroup
            label="고급"
            items={advancedItems}
            selectedSection={selectedSection}
            selectSection={selectSection}
          />
        </aside>

        <main className="settings-ops-main">
          <header className="settings-ops-main-head">
            <div>
              <h2>{selectedLabel}</h2>
              <small>/{page.slug || 'page'}</small>
            </div>
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

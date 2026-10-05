import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Code2,
  Copy,
  CreditCard,
  FileText,
  Gift,
  Globe2,
  History,
  Images,
  RotateCcw,
  Search,
  Target,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import MediaLibrarySettings from './MediaLibrarySettings.jsx';
import SettingsAdvancedAndReset from './SettingsAdvancedAndReset.jsx';
import PageDuplicateUrlModal from './PageDuplicateUrlModal.jsx';
import SettingsPrimarySections from './SettingsPrimarySections.jsx';

const PRIMARY_NAV = [
  ['basic', '페이지 기본', FileText],
  ['media', '미디어 보관함', Images],
  ['domain', '개인 도메인', Globe2],
  ['account', '계정 정보', UserRound],
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
  ['history', '버전 기록', History],
  ['duplicate', '페이지 복제', Copy],
  ['reset', '초기화', RotateCcw],
];

const ALL_NAV = [...PRIMARY_NAV, ...SERVICE_NAV, ...ADVANCED_NAV];
const ADVANCED_IDS = new Set(ADVANCED_NAV.map(([id]) => id));

function SettingsNavGroup({ label, items, selectedSection, selectSection, registerNavButton }) {
  const labelId = `settings-nav-${label}-label`;
  return (
    <nav className="settings-nav-group" aria-labelledby={labelId}>
      <span id={labelId} className="settings-nav-label">{label}</span>
      <div className="settings-nav-items">
        {items.map(([id, itemLabel, Icon]) => (
          <button
            key={id}
            ref={(node) => registerNavButton?.(id, node)}
            type="button"
            className={`settings-nav-item ${selectedSection === id ? 'active' : ''}`}
            aria-current={selectedSection === id ? 'page' : undefined}
            aria-controls="settings-active-panel"
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
  canDeleteMedia,
  canDuplicatePage,
  canManageProjectUsers,
  canReadMedia,
  clientAdminMode,
  duplicateSettings,
  drafts,
  integrations,
  managerSettings,
  onAccountUpdate,
  onLogout,
  onReset,
  onSavePage,
  ownership,
  page,
  projectSettingsWritable,
  sections,
  setPage,
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

  const primaryItems = useMemo(() => PRIMARY_NAV.filter(([id]) => {
    if (id === 'managers' && !canManageProjectUsers) return false;
    if (id === 'media' && !canReadMedia) return false;
    if (id === 'domain' && (!ownerFinanceAccess || !projectSettingsWritable)) return false;
    return true;
  }), [canManageProjectUsers, canReadMedia, ownerFinanceAccess, projectSettingsWritable]);

  const serviceItems = useMemo(
    () => ownerFinanceAccess ? SERVICE_NAV : [],
    [ownerFinanceAccess],
  );

  const advancedItems = useMemo(() => {
    if (clientAdminMode || !projectSettingsWritable) return [];
    return ADVANCED_NAV.filter(([id]) => {
      if (id === 'duplicate' && !canDuplicatePage) return false;
      if (id === 'reset' && !canManageProjectUsers) return false;
      return true;
    });
  }, [canDuplicatePage, canManageProjectUsers, clientAdminMode, projectSettingsWritable]);

  const availableItems = useMemo(
    () => [...primaryItems, ...serviceItems, ...advancedItems],
    [advancedItems, primaryItems, serviceItems],
  );
  const availableIds = useMemo(() => new Set(availableItems.map(([id]) => id)), [availableItems]);
  const initialSection = availableIds.has(openSection) ? openSection : (primaryItems[0]?.[0] || 'account');
  const [selectedSection, setSelectedSection] = useState(initialSection);
  const navButtonRefs = useRef(new Map());
  const previousSectionRef = useRef(selectedSection);
  const selectedLabel = ALL_NAV.find(([id]) => id === selectedSection)?.[1] || '페이지 기본';

  const selectSection = (id) => {
    if (!availableIds.has(id)) return;
    setSelectedSection(id);
    setAdvancedOpen(ADVANCED_IDS.has(id));
    setOpenSection(id);
  };

  useEffect(() => {
    if (availableIds.has(selectedSection)) return;
    const fallback = primaryItems[0]?.[0] || 'account';
    setSelectedSection(fallback);
    setAdvancedOpen(false);
    setOpenSection(fallback);
  }, [availableIds, primaryItems, selectedSection, setAdvancedOpen, setOpenSection]);

  useEffect(() => {
    const previousSection = previousSectionRef.current;
    previousSectionRef.current = selectedSection;
    if (previousSection === selectedSection || typeof document === 'undefined') return;

    const active = document.activeElement;
    const focusLost = !active
      || active === document.body
      || active === document.documentElement
      || !active.isConnected;

    if (focusLost) {
      navButtonRefs.current.get(selectedSection)?.focus?.({ preventScroll: true });
    }
  }, [selectedSection]);

  const registerNavButton = (id, node) => {
    if (node) navButtonRefs.current.set(id, node);
    else navButtonRefs.current.delete(id);
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
    <div className="settings-v3-root settings-v4-flat">
      <aside className="settings-v3-sidebar">
        <SettingsNavGroup
          label="페이지"
          items={primaryItems}
          selectedSection={selectedSection}
          selectSection={selectSection}
          registerNavButton={registerNavButton}
        />
        {serviceItems.length > 0 && (
          <SettingsNavGroup
            label="서비스"
            items={serviceItems}
            selectedSection={selectedSection}
            selectSection={selectSection}
          />
        )}
        {advancedItems.length > 0 && (
          <SettingsNavGroup
            label="고급"
            items={advancedItems}
            selectedSection={selectedSection}
            selectSection={selectSection}
          />
        )}
      </aside>

      <main className="settings-v3-main">
        <div className="settings-v3-content-wrap">
          <header className="settings-page-head settings-page-head-compact">
            <h1 id="settings-active-title">{selectedLabel}</h1>
          </header>

          <div
            id="settings-active-panel"
            className="settings-v3-content"
            role="region"
            tabIndex={-1}
            aria-labelledby="settings-active-title"
          >
            {selectedSection === 'media' && canReadMedia && (
              <MediaLibrarySettings
                page={page}
                authUser={authUser}
                canDelete={canDeleteMedia}
              />
            )}

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
              onSavePage={onSavePage}
              ownership={ownership}
              projectSettingsWritable={projectSettingsWritable}
              sections={visibleSections}
              transferRequest={transferRequest}
              updateIntegrations={updateIntegrations}
            />

            <SettingsAdvancedAndReset
              activeSection={selectedSection}
              authUser={authUser}
              canDuplicatePage={canDuplicatePage}
              canResetProject={canManageProjectUsers}
              clientAdminMode={clientAdminMode}
              duplicateSettings={duplicateSettings}
              drafts={drafts}
              integrations={integrations}
              onReset={onReset}
              page={page}
              projectSettingsWritable={projectSettingsWritable}
              sections={visibleSections}
              setPage={setPage}
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

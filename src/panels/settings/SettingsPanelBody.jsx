import { useState } from 'react';
import SettingsAdvancedAndReset from './SettingsAdvancedAndReset.jsx';
import PageDuplicateUrlModal from './PageDuplicateUrlModal.jsx';
import SettingsPrimarySections from './SettingsPrimarySections.jsx';

const PRIMARY_NAV = [
  ['account', '계정 정보'],
  ['basic', '페이지 기본'],
  ['managers', '매니저 권한'],
];

const ADVANCED_NAV = [
  ['seo', 'SEO 설정'],
  ['tracking', '추적 코드'],
  ['conversion', '전환 설정'],
  ['duplicate', '페이지 복제'],
  ['reset', '초기화'],
];

const ALL_NAV = [...PRIMARY_NAV, ...ADVANCED_NAV];
const ADVANCED_IDS = new Set(ADVANCED_NAV.map(([id]) => id));

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
  const initialSection = (() => {
    const requested = openSection || 'account';
    if (clientAdminMode && ADVANCED_IDS.has(requested)) return 'account';
    if (!canManageProjectUsers && requested === 'managers') return 'account';
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
            <strong>설정 메뉴</strong>
            <span>{page.title || '현재 페이지'}</span>
          </div>

          <nav className="settings-ops-nav" aria-label="기본 설정">
            <small>기본</small>
            {PRIMARY_NAV.filter(([id]) => id !== 'managers' || canManageProjectUsers).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`settings-ops-nav-item ${selectedSection === id ? 'active' : ''}`}
                onClick={() => selectSection(id)}
              >
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {!clientAdminMode && (
            <nav className="settings-ops-nav advanced" aria-label="고급 설정">
              <small>고급</small>
              {ADVANCED_NAV.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`settings-ops-nav-item ${selectedSection === id ? 'active' : ''}`}
                  onClick={() => selectSection(id)}
                >
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
              managerSettings={managerSettings}
              onAccountUpdate={onAccountUpdate}
              onLogout={onLogout}
              ownership={ownership}
              sections={visibleSections}
              transferRequest={transferRequest}
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
            <small>현재 설정</small>
            <h3>{page.title || '현재 페이지'}</h3>
          </header>

          <dl>
            <div>
              <dt>공개 주소</dt>
              <dd>/{page.slug || 'page'}</dd>
            </div>
            <div>
              <dt>관리 계정</dt>
              <dd>{authUser?.email || '연결 없음'}</dd>
            </div>
            <div>
              <dt>매니저</dt>
              <dd>{managerCount}명</dd>
            </div>
            <div>
              <dt>운영 상태</dt>
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

import SettingsSection from './SettingsSection.jsx';

export default function PageDuplicateSettingsSection({
  canDuplicatePage,
  setDuplicateOpen,
}) {
  return (
    <SettingsSection id="duplicate" className="page-duplicate-card settings-flat-section">
      <div className="settings-flat-block settings-flat-row">
        <div>
          <strong>페이지 복제</strong>
          <span className="settings-flat-value">블록 · 스타일 · 폼 · CTA · SEO</span>
        </div>
        <button type="button" className="settings-primary-button compact" onClick={() => setDuplicateOpen(true)}>
          {canDuplicatePage ? '복제' : 'URL 설정'}
        </button>
      </div>
    </SettingsSection>
  );
}

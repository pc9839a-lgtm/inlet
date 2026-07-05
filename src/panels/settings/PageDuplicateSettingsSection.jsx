import SettingsSection from './SettingsSection.jsx';

export default function PageDuplicateSettingsSection({
  canDuplicatePage,
  openSection,
  setDuplicateOpen,
  setOpenSection,
}) {
  return (
    <SettingsSection
      id="duplicate"
      title="페이지 복제"
      description="현재 페이지를 새 URL로 복사"
      badge="유료"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="page-duplicate-card"
    >
      <div className="page-duplicate-summary">
        <div>
          <strong>복제 범위</strong>
          <p>설정, 블록, 스타일, 폼, CTA, 효과, SEO 기본값만 복사합니다.</p>
        </div>
        <button type="button" onClick={() => setDuplicateOpen(true)}>URL 설정</button>
      </div>
      {!canDuplicatePage && (
        <p className="page-duplicate-lock">결제 연동 전까지는 URL 설정 흐름만 확인할 수 있습니다.</p>
      )}
    </SettingsSection>
  );
}

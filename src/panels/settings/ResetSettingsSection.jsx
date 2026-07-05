import SettingsSection from './SettingsSection.jsx';

export default function ResetSettingsSection({
  onReset,
  openSection,
  setOpenSection,
}) {
  return (
    <SettingsSection id="reset" title="초기화" description="페이지와 접수 데이터 삭제" badge="주의" openSection={openSection} setOpenSection={setOpenSection} className="danger-zone">
      <button className="reset-danger" onClick={onReset}>전체 데이터 초기화</button>
    </SettingsSection>
  );
}

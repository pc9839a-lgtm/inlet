import SettingsSection from './SettingsSection.jsx';

export default function ResetSettingsSection({ onReset }) {
  const handleReset = () => {
    const confirmed = window.confirm('페이지와 접수 데이터를 초기화합니다. 이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?');
    if (confirmed) onReset();
  };

  return (
    <SettingsSection id="reset" className="danger-zone">
      <section className="settings-surface settings-danger-zone">
        <div className="settings-danger-copy">
          <span>위험 영역</span>
          <strong>페이지 전체 데이터 초기화</strong>
          <p>페이지 설정과 접수 데이터를 초기 상태로 되돌립니다. 삭제된 데이터는 복구할 수 없습니다.</p>
        </div>
        <button className="settings-danger-button" type="button" onClick={handleReset}>전체 데이터 초기화</button>
      </section>
    </SettingsSection>
  );
}

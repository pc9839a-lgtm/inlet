import SettingsSection from './SettingsSection.jsx';

export default function ResetSettingsSection({ onReset }) {
  const handleReset = () => {
    const confirmed = window.confirm('페이지와 접수 데이터를 초기화합니다. 되돌릴 수 없습니다. 계속하시겠습니까?');
    if (confirmed) onReset();
  };

  return (
    <SettingsSection id="reset" className="danger-zone settings-flat-section">
      <div className="settings-flat-block settings-flat-row settings-danger-row">
        <div>
          <strong>전체 데이터 초기화</strong>
          <span className="settings-flat-value">복구 불가</span>
        </div>
        <button className="settings-danger-button compact" type="button" onClick={handleReset}>초기화</button>
      </div>
    </SettingsSection>
  );
}

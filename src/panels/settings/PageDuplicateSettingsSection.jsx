import { Copy } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';

export default function PageDuplicateSettingsSection({
  canDuplicatePage,
  setDuplicateOpen,
}) {
  return (
    <SettingsSection id="duplicate" className="page-duplicate-card">
      <section className="settings-surface page-duplicate-surface">
        <div className="settings-surface-head simple">
          <div className="settings-icon-title">
            <span className="settings-icon-box"><Copy size={19} aria-hidden="true" /></span>
            <div>
              <strong>현재 페이지 복제</strong>
              <small>현재 구성을 새로운 공개 주소로 복사합니다.</small>
            </div>
          </div>
        </div>

        <div className="settings-info-list">
          <div className="settings-info-row">
            <div>
              <span>복제 범위</span>
              <strong>블록 · 스타일 · 폼 · CTA · 효과 · SEO 기본값</strong>
              <small>접수 데이터와 기존 URL의 운영 데이터는 복제하지 않습니다.</small>
            </div>
          </div>
          <div className="settings-info-row">
            <div>
              <span>새 공개 주소</span>
              <strong>복제할 URL을 직접 지정합니다.</strong>
              <small>{canDuplicatePage ? '사용 가능한 주소인지 확인한 뒤 복제를 진행합니다.' : '현재는 URL 설정 흐름만 확인할 수 있습니다.'}</small>
            </div>
            <button type="button" className="settings-primary-button" onClick={() => setDuplicateOpen(true)}>URL 설정</button>
          </div>
        </div>
      </section>
    </SettingsSection>
  );
}

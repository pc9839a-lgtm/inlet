import { ImageInput } from '../../editor/controls.jsx';
import SettingsField from './SettingsField.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function SeoSettingsSection({
  locked,
  onEdit,
  onSave,
  seoDraft,
  setSeoDraft,
}) {
  return (
    <SettingsSection
      id="seo"
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      actionNote="검색·공유 정보 변경사항을 확인한 뒤 저장하세요."
      className="settings-seo-card"
    >
      <div className="settings-stack settings-seo-layout">
        <section className="settings-surface settings-seo-block settings-seo-copy">
          <header className="settings-surface-head simple">
            <div>
              <strong>검색 정보</strong>
              <small>검색 결과에 표시되는 제목과 설명입니다.</small>
            </div>
          </header>
          <div className="settings-form-grid settings-seo-copy-grid">
            <SettingsField
              label="메타 제목"
              value={seoDraft.title}
              disabled={locked}
              placeholder="강남 피부관리 상담 예약 | 브랜드명"
              hint={`${String(seoDraft.title || '').length}자 · 검색 결과에서 잘리지 않도록 간결하게 작성하세요.`}
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, title: value }))}
            />
            <SettingsField
              label="메타 설명"
              textarea
              value={seoDraft.desc}
              disabled={locked}
              placeholder="무료 상담, 방문 예약, 혜택을 80자 안팎으로 요약"
              hint={`${String(seoDraft.desc || '').length}자 · 페이지 내용을 자연스럽게 요약하세요.`}
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, desc: value }))}
            />
          </div>
        </section>

        <section className="settings-surface settings-seo-block settings-seo-media">
          <header className="settings-surface-head simple">
            <div>
              <strong>공유 이미지</strong>
              <small>브라우저 아이콘과 링크 공유 화면에 사용됩니다.</small>
            </div>
          </header>
          <div className="settings-seo-media-grid">
            <div className="settings-field-with-help settings-seo-favicon">
              <ImageInput label="파비콘" value={seoDraft.favicon} disabled={locked} onChange={(value) => setSeoDraft((draft) => ({ ...draft, favicon: value }))} />
              <small className="settings-field-help">권장 32×32 PNG 또는 ICO</small>
            </div>
            <div className="settings-field-with-help settings-seo-share">
              <ImageInput label="공유 이미지" value={seoDraft.og} disabled={locked} onChange={(value) => setSeoDraft((draft) => ({ ...draft, og: value }))} />
              <small className="settings-field-help">권장 1200×630 JPG, PNG 또는 WebP</small>
            </div>
          </div>
        </section>

        <section className="settings-surface settings-seo-block settings-seo-verification">
          <header className="settings-surface-head simple">
            <div>
              <strong>검색 도구 인증</strong>
              <small>태그 전체가 아니라 발급받은 content 값만 입력합니다.</small>
            </div>
          </header>
          <div className="settings-form-grid settings-seo-verification-grid">
            <SettingsField
              label="네이버 서치어드바이저"
              value={seoDraft.naverWebmaster}
              disabled={locked}
              placeholder="naver-site-verification content 값"
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, naverWebmaster: value }))}
            />
            <SettingsField
              label="Google Search Console"
              value={seoDraft.console}
              disabled={locked}
              placeholder="google-site-verification content 값"
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, console: value }))}
            />
          </div>
        </section>
      </div>
    </SettingsSection>
  );
}

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
      className="settings-seo-card settings-flat-section"
    >
      <div className="seo-settings-screen">
        <section className="seo-setting-row">
          <div className="seo-setting-label">
            <strong>검색 정보</strong>
            <span>검색 결과에 표시되는 제목과 설명</span>
          </div>
          <div className="seo-copy-grid">
            <SettingsField
              label="메타 제목"
              value={seoDraft.title}
              disabled={locked}
              placeholder="검색 결과 제목"
              hint={`${String(seoDraft.title || '').length}자`}
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, title: value }))}
            />
            <SettingsField
              label="메타 설명"
              textarea
              value={seoDraft.desc}
              disabled={locked}
              placeholder="검색 결과 설명"
              hint={`${String(seoDraft.desc || '').length}자`}
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, desc: value }))}
            />
          </div>
        </section>

        <section className="seo-setting-row seo-media-row">
          <div className="seo-setting-label">
            <strong>이미지</strong>
            <span>파비콘과 공유 미리보기</span>
          </div>
          <div className="settings-seo-media-grid">
            <ImageInput
              label="파비콘"
              variant="favicon"
              value={seoDraft.favicon}
              disabled={locked}
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, favicon: value }))}
            />
            <ImageInput
              label="공유 이미지"
              variant="share"
              value={seoDraft.og}
              disabled={locked}
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, og: value }))}
            />
          </div>
        </section>

        <section className="seo-setting-row">
          <div className="seo-setting-label">
            <strong>검색 도구 인증</strong>
            <span>필요한 경우에만 입력</span>
          </div>
          <div className="seo-verification-grid">
            <SettingsField
              label="네이버"
              value={seoDraft.naverWebmaster}
              disabled={locked}
              placeholder="verification content"
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, naverWebmaster: value }))}
            />
            <SettingsField
              label="Google"
              value={seoDraft.console}
              disabled={locked}
              placeholder="verification content"
              onChange={(value) => setSeoDraft((draft) => ({ ...draft, console: value }))}
            />
          </div>
        </section>
      </div>
    </SettingsSection>
  );
}

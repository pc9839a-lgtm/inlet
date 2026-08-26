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
  const compactRowStyle = {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '12px',
    padding: '20px 0',
  };

  return (
    <SettingsSection
      id="seo"
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      className="settings-seo-card settings-flat-section"
      style={{ maxWidth: '860px' }}
    >
      <div className="seo-settings-screen">
        <section className="seo-setting-row" style={compactRowStyle}>
          <div className="seo-setting-label" style={{ paddingTop: 0 }}>
            <strong>검색 정보</strong>
            <span>검색 결과에 표시되는 제목과 설명</span>
          </div>
          <div
            className="seo-copy-grid"
            style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: '14px' }}
          >
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

        <section className="seo-setting-row seo-media-row" style={compactRowStyle}>
          <div className="seo-setting-label" style={{ paddingTop: 0 }}>
            <strong>이미지</strong>
            <span>파비콘과 공유 미리보기</span>
          </div>
          <div
            className="settings-seo-media-grid"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px 20px',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ width: '112px', flex: '0 0 112px' }}>
              <ImageInput
                label="파비콘"
                variant="favicon"
                value={seoDraft.favicon}
                disabled={locked}
                onChange={(value) => setSeoDraft((draft) => ({ ...draft, favicon: value }))}
              />
            </div>
            <div style={{ width: '340px', maxWidth: '100%', flex: '1 1 300px' }}>
              <ImageInput
                label="공유 이미지"
                variant="share"
                value={seoDraft.og}
                disabled={locked}
                onChange={(value) => setSeoDraft((draft) => ({ ...draft, og: value }))}
              />
            </div>
          </div>
        </section>

        <section className="seo-setting-row" style={compactRowStyle}>
          <div className="seo-setting-label" style={{ paddingTop: 0 }}>
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

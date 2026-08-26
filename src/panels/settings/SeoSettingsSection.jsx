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

  const searchSectionStyle = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '16px',
    padding: '20px 0',
  };

  const searchHeadingStyle = {
    display: 'grid',
    gap: '4px',
  };

  const metaFieldsStyle = {
    width: '100%',
    maxWidth: '720px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '14px',
  };

  const metaFieldStyle = {
    display: 'grid',
    gap: '6px',
  };

  const metaLabelStyle = {
    color: '#101828',
    fontSize: '14px',
    fontWeight: 850,
    lineHeight: 1.3,
  };

  const metaControlStyle = {
    width: '100%',
    height: '44px',
    minHeight: '44px',
    boxSizing: 'border-box',
  };

  const metaTextareaStyle = {
    ...metaControlStyle,
    padding: '11px 12px',
    resize: 'none',
    overflow: 'hidden',
  };

  const metaCountStyle = {
    margin: 0,
    color: '#667085',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.35,
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
        <section className="seo-setting-row seo-search-row" style={searchSectionStyle}>
          <div className="seo-setting-label" style={{ ...searchHeadingStyle, paddingTop: 0 }}>
            <strong>검색 정보</strong>
            <span>검색 결과에 표시되는 제목과 설명</span>
          </div>

          <div className="seo-meta-fields" style={metaFieldsStyle}>
            <label className="seo-meta-field" style={metaFieldStyle}>
              <span style={metaLabelStyle}>메타 제목</span>
              <input
                type="text"
                value={seoDraft.title || ''}
                disabled={locked}
                placeholder="검색 결과 제목"
                style={metaControlStyle}
                onChange={(event) => setSeoDraft((draft) => ({ ...draft, title: event.target.value }))}
              />
              <small style={metaCountStyle}>{String(seoDraft.title || '').length} / 60</small>
            </label>

            <label className="seo-meta-field" style={metaFieldStyle}>
              <span style={metaLabelStyle}>메타 설명</span>
              <textarea
                rows={1}
                value={seoDraft.desc || ''}
                disabled={locked}
                placeholder="검색 결과 설명"
                style={metaTextareaStyle}
                onChange={(event) => setSeoDraft((draft) => ({ ...draft, desc: event.target.value }))}
              />
              <small style={metaCountStyle}>{String(seoDraft.desc || '').length} / 160</small>
            </label>
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

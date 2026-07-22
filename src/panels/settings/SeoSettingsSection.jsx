import { Field, ImageInput } from '../../editor/controls.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function SeoSettingsSection({
  locked,
  onEdit,
  onSave,
  openSection,
  seoDraft,
  setOpenSection,
  setSeoDraft,
}) {
  return (
    <SettingsSection id="seo" title="SEO 설정" description="검색과 공유 정보" openSection={openSection} setOpenSection={setOpenSection} locked={locked} onSave={onSave} onEdit={onEdit} className="settings-seo-card">
      <div className="settings-grid">
        <div className="settings-field-hint-wrap">
          <Field label="메타 제목" value={seoDraft.title} disabled={locked} placeholder="강남 피부관리 상담 예약 | 브랜드명" onChange={(value) => setSeoDraft((draft) => ({ ...draft, title: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="메타 설명" textarea value={seoDraft.desc} disabled={locked} placeholder="무료 상담, 방문 예약, 혜택을 80자 안팎으로 요약" onChange={(value) => setSeoDraft((draft) => ({ ...draft, desc: value }))} />
        </div>
        <div className="settings-field-hint-wrap settings-seo-favicon">
          <ImageInput label="파비콘" value={seoDraft.favicon} disabled={locked} onChange={(value) => setSeoDraft((draft) => ({ ...draft, favicon: value }))} />
          <small className="settings-field-hint">32x32 PNG/ICO</small>
        </div>
        <div className="settings-field-hint-wrap settings-seo-og-image">
          <ImageInput label="공유 이미지" value={seoDraft.og} disabled={locked} onRequestEdit={onEdit} onChange={(value) => setSeoDraft((draft) => ({ ...draft, og: value }))} />
          <small className="settings-field-hint">1200x630 JPG/PNG/WebP</small>
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="네이버 웹마스터" value={seoDraft.naverWebmaster} disabled={locked} placeholder="naver-site-verification content 값" onChange={(value) => setSeoDraft((draft) => ({ ...draft, naverWebmaster: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="구글 콘솔" value={seoDraft.console} disabled={locked} placeholder="google-site-verification content 값" onChange={(value) => setSeoDraft((draft) => ({ ...draft, console: value }))} />
        </div>
      </div>
    </SettingsSection>
  );
}

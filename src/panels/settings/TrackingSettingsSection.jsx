import { Field } from '../../editor/controls.jsx';
import SettingsSection from './SettingsSection.jsx';

export default function TrackingSettingsSection({
  locked,
  onEdit,
  onSave,
  openSection,
  setOpenSection,
  setTrackingDraft,
  trackingDraft,
}) {
  return (
    <SettingsSection id="tracking" title="추적 코드" description="광고·분석 ID" openSection={openSection} setOpenSection={setOpenSection} locked={locked} onSave={onSave} onEdit={onEdit}>
      <div className="settings-grid">
        <div className="settings-field-hint-wrap">
          <Field label="GTM" value={trackingDraft.gtm} disabled={locked} placeholder="GTM-XXXXXXX" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, gtm: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="GA4" value={trackingDraft.ga4} disabled={locked} placeholder="G-XXXXXXXXXX" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, ga4: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="Google Ads" value={trackingDraft.googleAdsTag} disabled={locked} placeholder="AW-123456789" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, googleAdsTag: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="Meta Pixel" value={trackingDraft.pixel} disabled={locked} placeholder="123456789012345" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, pixel: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="네이버 WCS" value={trackingDraft.naver} disabled={locked} placeholder="s_abcdef1234" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, naver: value }))} />
        </div>
        <div className="settings-field-hint-wrap">
          <Field label="카카오 픽셀" value={trackingDraft.kakao} disabled={locked} placeholder="카카오 픽셀 ID" onChange={(value) => setTrackingDraft((draft) => ({ ...draft, kakao: value }))} />
        </div>
      </div>
    </SettingsSection>
  );
}

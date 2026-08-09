import SettingsField from './SettingsField.jsx';
import SettingsSection from './SettingsSection.jsx';

function formatError(value, pattern, message) {
  const text = String(value || '').trim();
  return text && !pattern.test(text) ? message : '';
}

export default function TrackingSettingsSection({
  locked,
  onEdit,
  onSave,
  setTrackingDraft,
  trackingDraft,
}) {
  return (
    <SettingsSection
      id="tracking"
      locked={locked}
      onSave={onSave}
      onEdit={onEdit}
      className="settings-flat-section"
    >
      <div className="settings-flat-block">
        <div className="settings-form-grid">
          <SettingsField
            label="Google Tag Manager"
            value={trackingDraft.gtm}
            disabled={locked}
            placeholder="GTM-XXXXXXX"
            error={formatError(trackingDraft.gtm, /^GTM-[A-Z0-9]+$/i, 'GTM 형식을 확인하세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, gtm: value }))}
          />
          <SettingsField
            label="Google Analytics 4"
            value={trackingDraft.ga4}
            disabled={locked}
            placeholder="G-XXXXXXXXXX"
            error={formatError(trackingDraft.ga4, /^G-[A-Z0-9]+$/i, 'GA4 형식을 확인하세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, ga4: value }))}
          />
          <SettingsField
            label="Google Ads"
            value={trackingDraft.googleAdsTag}
            disabled={locked}
            placeholder="AW-123456789"
            error={formatError(trackingDraft.googleAdsTag, /^AW-\d+$/i, 'Google Ads 형식을 확인하세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, googleAdsTag: value }))}
          />
          <SettingsField
            label="Meta Pixel"
            value={trackingDraft.pixel}
            disabled={locked}
            placeholder="123456789012345"
            error={formatError(trackingDraft.pixel, /^\d+$/, 'Pixel ID를 확인하세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, pixel: value }))}
          />
          <SettingsField
            label="네이버 WCS"
            value={trackingDraft.naver}
            disabled={locked}
            placeholder="s_abcdef1234"
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, naver: value }))}
          />
          <SettingsField
            label="카카오 픽셀"
            value={trackingDraft.kakao}
            disabled={locked}
            placeholder="픽셀 ID"
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, kakao: value }))}
          />
        </div>
      </div>
    </SettingsSection>
  );
}

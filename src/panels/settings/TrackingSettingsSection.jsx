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
      actionNote="사용 중인 추적 ID만 입력하고 저장하세요. 빈 항목은 설치하지 않습니다."
    >
      <section className="settings-surface settings-form-surface">
        <header className="settings-surface-head simple">
          <div>
            <strong>광고 · 분석 추적</strong>
            <small>각 서비스에서 발급받은 ID만 입력합니다.</small>
          </div>
        </header>
        <div className="settings-form-grid">
          <SettingsField
            label="Google Tag Manager"
            value={trackingDraft.gtm}
            disabled={locked}
            placeholder="GTM-XXXXXXX"
            error={formatError(trackingDraft.gtm, /^GTM-[A-Z0-9]+$/i, 'GTM-XXXXXXX 형식으로 입력해주세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, gtm: value }))}
          />
          <SettingsField
            label="Google Analytics 4"
            value={trackingDraft.ga4}
            disabled={locked}
            placeholder="G-XXXXXXXXXX"
            error={formatError(trackingDraft.ga4, /^G-[A-Z0-9]+$/i, 'G-XXXXXXXXXX 형식으로 입력해주세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, ga4: value }))}
          />
          <SettingsField
            label="Google Ads"
            value={trackingDraft.googleAdsTag}
            disabled={locked}
            placeholder="AW-123456789"
            error={formatError(trackingDraft.googleAdsTag, /^AW-\d+$/i, 'AW-숫자 형식으로 입력해주세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, googleAdsTag: value }))}
          />
          <SettingsField
            label="Meta Pixel"
            value={trackingDraft.pixel}
            disabled={locked}
            placeholder="123456789012345"
            error={formatError(trackingDraft.pixel, /^\d+$/, '숫자로 된 Pixel ID를 입력해주세요.')}
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, pixel: value }))}
          />
          <SettingsField
            label="네이버 WCS"
            value={trackingDraft.naver}
            disabled={locked}
            placeholder="s_abcdef1234"
            hint="네이버 프리미엄 로그분석에서 발급받은 ID를 입력합니다."
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, naver: value }))}
          />
          <SettingsField
            label="카카오 픽셀"
            value={trackingDraft.kakao}
            disabled={locked}
            placeholder="카카오 픽셀 ID"
            onChange={(value) => setTrackingDraft((draft) => ({ ...draft, kakao: value }))}
          />
        </div>
      </section>
    </SettingsSection>
  );
}

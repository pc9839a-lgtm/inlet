import { Toggle } from '../../editor/controls.jsx';

const ALWAYS_VISIBLE_TOGGLES = [
  {
    key: 'enabled',
    label: '\uC804\uD658 \uAE30\uB85D',
  },
  {
    key: 'dataLayer',
    label: 'dataLayer',
  },
];

const READY_TOGGLES = [
  {
    readyKey: 'pixel',
    integrationKey: 'metaPixel',
    label: 'Meta Pixel',
  },
  {
    readyKey: 'ads',
    integrationKey: 'googleAds',
    label: 'Google Ads',
  },
  {
    readyKey: 'naver',
    integrationKey: 'naver',
    label: 'Naver',
  },
  {
    readyKey: 'kakao',
    integrationKey: 'kakao',
    label: 'Kakao',
  },
];

export default function ConversionToggleList({ conversionReady, integrations, updateIntegrations }) {
  return (
    <>
      {ALWAYS_VISIBLE_TOGGLES.map((item) => (
        <Toggle
          key={item.key}
          label={item.label}
          checked={!!integrations.conversion[item.key]}
          onChange={(value) => updateIntegrations('conversion', { [item.key]: value })}
        />
      ))}
      {READY_TOGGLES.filter((item) => conversionReady[item.readyKey]).map((item) => (
        <Toggle
          key={item.integrationKey}
          label={item.label}
          checked={!!integrations.conversion[item.integrationKey]}
          onChange={(value) => updateIntegrations('conversion', { [item.integrationKey]: value })}
        />
      ))}
    </>
  );
}

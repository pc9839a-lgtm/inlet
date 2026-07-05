import { Field, Step, Toggle } from '../controls.jsx';

export default function TimerCtaTargetSection({ s, set, page, TargetControl }) {
  return (
    <Step title="CTA 연결" icon="3">
      <Toggle label="CTA" checked={!!s.cta} onChange={(v) => set({ cta: v })} />
      {s.cta && (
        <>
          <Field label="문구" value={s.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
          <TargetControl
            label="이동"
            target={s.ctaTarget}
            url={s.ctaUrl}
            lastWidgetTarget={s.ctaLastWidgetTarget}
            page={page}
            onChange={(patch) =>
              set({ ctaTarget: patch.target, ctaUrl: patch.url, ctaLastWidgetTarget: patch.lastWidgetTarget })
            }
          />
        </>
      )}
    </Step>
  );
}

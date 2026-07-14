import { EditorField, ToggleRow } from '../ui/index.js';

export default function TimerCtaTargetSection({ s, set, page, TargetControl }) {
  return (
    <>
      <ToggleRow label="CTA 버튼" checked={Boolean(s.cta)} onChange={(value) => set({ cta: value })} />
      {s.cta && (
        <>
          <EditorField label="버튼 문구">
            <input value={s.ctaLabel || ''} onChange={(event) => set({ ctaLabel: event.target.value })} />
          </EditorField>
          <TargetControl
            label="이동"
            target={s.ctaTarget}
            url={s.ctaUrl}
            lastWidgetTarget={s.ctaLastWidgetTarget}
            page={page}
            onChange={(patch) => set({ ctaTarget: patch.target, ctaUrl: patch.url, ctaLastWidgetTarget: patch.lastWidgetTarget })}
          />
        </>
      )}
    </>
  );
}
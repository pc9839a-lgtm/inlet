import { Choice, EditorStack, Field, Step, Toggle } from '../controls.jsx';

export default function TimerEditor({ s, set, page, TargetControl }) {
  return (
    <EditorStack>
      <Step title="타이머" icon="1" open>
        <Field label="문구" value={s.label} onChange={(v) => set({ label: v })} />
        <Choice label="방식" value={s.repeatMode || 'fixed'} onChange={(v) => set({ repeatMode: v })} options={[['fixed', '마감일'], ['daily24', '매일 반복']]} />
        {(s.repeatMode || 'fixed') === 'fixed' && (
          <Field label="마감일" type="datetime-local" value={s.endAt} onChange={(v) => set({ endAt: v })} />
        )}
        {(s.repeatMode || 'fixed') === 'daily24' && (
          <div className="timer-repeat-note modern">매일 24시간 기준으로 반복합니다.</div>
        )}
      </Step>

      <Step title="하단 CTA 연동" icon="2">
        <Toggle label="하단 CTA 표시" checked={!!s.floatOnBottom} onChange={(v) => set({ floatOnBottom: v })} />
        {s.floatOnBottom && <Field label="표시 문구" value={s.floatLabel || s.label || '오늘 마감까지'} onChange={(v) => set({ floatLabel: v })} />}
      </Step>

      <Step title="CTA 연결" icon="3">
        <Toggle label="CTA" checked={s.cta} onChange={(v) => set({ cta: v })} />
        {s.cta && (
          <>
            <Field label="문구" value={s.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
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
      </Step>
    </EditorStack>
  );
}

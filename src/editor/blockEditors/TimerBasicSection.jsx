import { Choice, Field, Step } from '../controls.jsx';
import { TIMER_REPEAT_OPTIONS, timerRepeatMode } from './timerEditorModel.js';

export default function TimerBasicSection({ s, set }) {
  const repeatMode = timerRepeatMode(s);

  return (
    <Step title="기본" icon="1" open>
      <Field label="문구" value={s.label} onChange={(v) => set({ label: v })} />
      <Choice label="방식" value={repeatMode} onChange={(v) => set({ repeatMode: v })} options={TIMER_REPEAT_OPTIONS} />
      {repeatMode === 'fixed' && (
        <Field label="마감일" type="datetime-local" value={s.endAt} onChange={(v) => set({ endAt: v })} />
      )}
      {repeatMode === 'daily24' && <div className="timer-repeat-note modern">매일 24시간 기준으로 반복됩니다.</div>}
    </Step>
  );
}

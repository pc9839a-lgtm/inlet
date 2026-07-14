import { EditorField, SegmentedControl } from '../ui/index.js';
import { TIMER_REPEAT_OPTIONS, timerRepeatMode } from './timerEditorModel.js';

export default function TimerBasicSection({ s, set }) {
  const repeatMode = timerRepeatMode(s);

  return (
    <>
      <EditorField label="문구">
        <input value={s.label || ''} onChange={(event) => set({ label: event.target.value })} />
      </EditorField>
      <SegmentedControl label="반복 방식" value={repeatMode} onChange={(value) => set({ repeatMode: value })} options={TIMER_REPEAT_OPTIONS.map(([value, label]) => ({ value, label }))} />
      {repeatMode === 'fixed' && (
        <EditorField label="마감일">
          <input type="datetime-local" value={s.endAt || ''} onChange={(event) => set({ endAt: event.target.value })} />
        </EditorField>
      )}
      {repeatMode === 'daily24' && <p className="timer-repeat-note modern">매일 24시간 기준으로 반복됩니다.</p>}
    </>
  );
}
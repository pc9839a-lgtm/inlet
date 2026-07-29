import { EditorField, SegmentedControl } from '../ui/index.js';
import { TIMER_REPEAT_OPTIONS, timerRepeatMode } from './timerEditorModel.js';

const TIMER_VARIANT_OPTIONS = [
  { value: 'minimal', label: '기본' },
  { value: 'flat', label: '플랫' },
  { value: 'block', label: '블록' },
  { value: 'line', label: '라인' },
  { value: 'point', label: '포인트' },
];

const TIMER_PALETTE_OPTIONS = [
  { value: 'ink', label: '블랙' },
  { value: 'blue', label: '블루' },
  { value: 'green', label: '그린' },
  { value: 'coral', label: '코랄' },
  { value: 'accent', label: '강조색' },
];

function safeValue(value, options, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

export default function TimerBasicSection({ s, set }) {
  const repeatMode = timerRepeatMode(s);
  const timerVariant = safeValue(s.timerVariant, TIMER_VARIANT_OPTIONS, 'minimal');
  const timerPalette = safeValue(s.timerPalette, TIMER_PALETTE_OPTIONS, 'ink');

  return (
    <>
      <SegmentedControl label="반복 방식" value={repeatMode} onChange={(value) => set({ repeatMode: value })} options={TIMER_REPEAT_OPTIONS.map(([value, label]) => ({ value, label }))} />
      {repeatMode === 'fixed' && (
        <EditorField label="마감일">
          <input type="datetime-local" value={s.endAt || ''} onChange={(event) => set({ endAt: event.target.value })} />
        </EditorField>
      )}
      {repeatMode === 'daily24' && <p className="timer-repeat-note modern">매일 24시간 기준으로 반복됩니다.</p>}
      <SegmentedControl label="스타일" value={timerVariant} onChange={(value) => set({ timerVariant: safeValue(value, TIMER_VARIANT_OPTIONS, 'minimal') })} options={TIMER_VARIANT_OPTIONS} />
      <SegmentedControl label="색상" value={timerPalette} onChange={(value) => set({ timerPalette: safeValue(value, TIMER_PALETTE_OPTIONS, 'ink') })} options={TIMER_PALETTE_OPTIONS} />
      <SegmentedControl
        label="움직임"
        value={s.timerMotion ? 'on' : 'off'}
        onChange={(value) => set({ timerMotion: value === 'on' })}
        options={[{ value: 'off', label: '끄기' }, { value: 'on', label: '켜기' }]}
      />
    </>
  );
}

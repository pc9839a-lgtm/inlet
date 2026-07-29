import { EditorField, SegmentedControl } from '../ui/index.js';
import { TIMER_REPEAT_OPTIONS, timerRepeatMode } from './timerEditorModel.js';

const TIMER_VARIANT_OPTIONS = [
  { value: 'minimal', label: '클린' },
  { value: 'flat', label: '카드' },
  { value: 'block', label: '프로모션' },
];

const TIMER_PALETTE_OPTIONS = [
  { value: 'ink', label: '블랙' },
  { value: 'blue', label: '블루' },
  { value: 'green', label: '그린' },
  { value: 'coral', label: '코랄' },
  { value: 'accent', label: '강조색' },
];

const LEGACY_TIMER_VARIANTS = {
  clean: 'minimal',
  cards: 'flat',
  promo: 'block',
  line: 'minimal',
  point: 'flat',
};

function safeValue(value, options, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

function safeTimerVariant(value) {
  return safeValue(LEGACY_TIMER_VARIANTS[value] || value, TIMER_VARIANT_OPTIONS, 'minimal');
}

export default function TimerBasicSection({ s, set }) {
  const repeatMode = timerRepeatMode(s);
  const timerVariant = safeTimerVariant(s.timerVariant);
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
      <SegmentedControl label="스타일" value={timerVariant} onChange={(value) => set({ timerVariant: safeTimerVariant(value) })} options={TIMER_VARIANT_OPTIONS} />
      <SegmentedControl label="색상" value={timerPalette} onChange={(value) => set({ timerPalette: safeValue(value, TIMER_PALETTE_OPTIONS, 'ink') })} options={TIMER_PALETTE_OPTIONS} />
      <SegmentedControl
        label="숫자 전환"
        value={s.timerMotion ? 'on' : 'off'}
        onChange={(value) => set({ timerMotion: value === 'on' })}
        options={[{ value: 'off', label: '없음' }, { value: 'on', label: '부드럽게' }]}
      />
    </>
  );
}

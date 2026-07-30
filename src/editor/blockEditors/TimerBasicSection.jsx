import { EditorField, SegmentedControl } from '../ui/index.js';
import { TIMER_REPEAT_OPTIONS, timerRepeatMode } from './timerEditorModel.js';

export const TIMER_VARIANT_OPTIONS = [
  { value: 'minimal', label: '클린', description: '숫자 중심의 가장 단순한 형태' },
  { value: 'flat', label: '카드', description: '숫자를 각각 카드로 구분' },
  { value: 'block', label: '프로모션', description: '마감 문구와 배지를 강하게 강조' },
];

export const TIMER_PALETTE_OPTIONS = [
  { value: 'ink', label: '블랙', color: '#111827' },
  { value: 'blue', label: '블루', color: '#2563eb' },
  { value: 'green', label: '그린', color: '#15803d' },
  { value: 'coral', label: '코랄', color: '#e85d4a' },
  { value: 'accent', label: '강조색', color: 'var(--accent, #7c3aed)' },
];

export const TIMER_EFFECT_OPTIONS = [
  { value: 'none', label: '없음', description: '움직임 없이 고정' },
  { value: 'slide', label: '슬라이드', description: '숫자가 아래에서 올라옴' },
  { value: 'flip', label: '플립', description: '숫자판이 뒤집히는 효과' },
  { value: 'pulse', label: '펄스', description: '숫자가 순간적으로 커짐' },
  { value: 'fire', label: '불꽃', description: '불꽃과 주황 글로우 강조' },
];

const LEGACY_TIMER_VARIANTS = {
  clean: 'minimal',
  cards: 'flat',
  promo: 'block',
  line: 'minimal',
  point: 'flat',
};

export function safeValue(value, options, fallback) {
  return options.some((option) => option.value === value) ? value : fallback;
}

export function safeTimerVariant(value) {
  return safeValue(LEGACY_TIMER_VARIANTS[value] || value, TIMER_VARIANT_OPTIONS, 'minimal');
}

export function safeTimerEffect(s = {}) {
  const legacy = s.timerMotion ? 'slide' : ({ flip: 'flip', flow: 'slide', line: 'pulse' }[s.urgentStyle]);
  return safeValue(s.timerEffect || legacy || 'none', TIMER_EFFECT_OPTIONS, 'none');
}

function TimerChoiceCards({ label, value, options, kind, onChange }) {
  return (
    <div className={`timer-workflow-control timer-workflow-${kind}`}>
      <div className="timer-workflow-control-head">
        <strong>{label}</strong>
        <span>{options.find((option) => option.value === value)?.description || ''}</span>
      </div>
      <div className="timer-workflow-choice-grid">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`timer-workflow-choice is-${kind} choice-${option.value}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="timer-workflow-choice-preview" aria-hidden="true">
              {kind === 'variant' && option.value === 'minimal' && <b>08 : 24 : 36</b>}
              {kind === 'variant' && option.value === 'flat' && <i><b>08</b><b>24</b><b>36</b></i>}
              {kind === 'variant' && option.value === 'block' && <i><em>마감 임박</em><b>08:24:36</b></i>}
              {kind === 'effect' && <b>08</b>}
            </span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function TimerPaletteCards({ value, onChange }) {
  return (
    <div className="timer-workflow-control timer-workflow-palette">
      <div className="timer-workflow-control-head">
        <strong>색상</strong>
        <span>페이지 분위기에 맞는 강조색을 선택합니다.</span>
      </div>
      <div className="timer-workflow-palette-grid">
        {TIMER_PALETTE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <i style={{ '--timer-palette-swatch': option.color }} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimerContentSection({ s, set }) {
  const repeatMode = timerRepeatMode(s);
  const timerVariant = safeTimerVariant(s.timerVariant);

  return (
    <div className="timer-workflow-stack timer-workflow-content">
      <div className="timer-workflow-intro">
        <strong>표시 문구와 마감 시간을 설정하세요.</strong>
        <span>문구를 비우면 해당 영역은 공개 화면에서 숨겨집니다.</span>
      </div>
      <EditorField label="상단 문구">
        <input
          type="text"
          value={s.label ?? '혜택 마감까지'}
          maxLength={40}
          placeholder="예: 얼리버드 신청 마감까지"
          onChange={(event) => set({ label: event.target.value })}
        />
      </EditorField>
      {timerVariant === 'block' && (
        <EditorField label="프로모션 배지">
          <input
            type="text"
            value={s.promoBadge ?? '마감 임박'}
            maxLength={16}
            placeholder="비워두면 숨김"
            onChange={(event) => set({ promoBadge: event.target.value })}
          />
        </EditorField>
      )}
      <EditorField label="종료 후 문구">
        <input
          type="text"
          value={s.ended ?? '종료되었습니다.'}
          maxLength={40}
          placeholder="예: 신청이 마감되었습니다."
          onChange={(event) => set({ ended: event.target.value })}
        />
      </EditorField>
      <div className="timer-workflow-divider" />
      <SegmentedControl
        label="반복 방식"
        value={repeatMode}
        onChange={(value) => set({ repeatMode: value })}
        options={TIMER_REPEAT_OPTIONS.map(([value, label]) => ({ value, label }))}
      />
      {repeatMode === 'fixed' && (
        <EditorField label="마감일과 시간">
          <input type="datetime-local" value={s.endAt || ''} onChange={(event) => set({ endAt: event.target.value })} />
        </EditorField>
      )}
      {repeatMode === 'daily24' && (
        <p className="timer-repeat-note modern timer-workflow-note">매일 자정에 다시 24시간으로 시작합니다.</p>
      )}
    </div>
  );
}

export function TimerDesignSection({ s, set }) {
  const timerVariant = safeTimerVariant(s.timerVariant);
  const timerPalette = safeValue(s.timerPalette, TIMER_PALETTE_OPTIONS, 'ink');
  const timerEffect = safeTimerEffect(s);

  return (
    <div className="timer-workflow-stack timer-workflow-design">
      <div className="timer-workflow-intro">
        <strong>실제 모양과 움직임을 보고 선택하세요.</strong>
        <span>하단 고정 타이머에도 선택한 디자인과 효과가 그대로 적용됩니다.</span>
      </div>
      <TimerChoiceCards
        label="스타일"
        value={timerVariant}
        options={TIMER_VARIANT_OPTIONS}
        kind="variant"
        onChange={(value) => set({ timerVariant: safeTimerVariant(value) })}
      />
      <TimerPaletteCards
        value={timerPalette}
        onChange={(value) => set({ timerPalette: safeValue(value, TIMER_PALETTE_OPTIONS, 'ink') })}
      />
      <TimerChoiceCards
        label="숫자 효과"
        value={timerEffect}
        options={TIMER_EFFECT_OPTIONS}
        kind="effect"
        onChange={(value) => {
          const next = safeValue(value, TIMER_EFFECT_OPTIONS, 'none');
          set({ timerEffect: next, timerMotion: next !== 'none' });
        }}
      />
    </div>
  );
}

export default function TimerBasicSection({ s, set }) {
  return (
    <div className="timer-workflow-stack">
      <TimerContentSection s={s} set={set} />
      <TimerDesignSection s={s} set={set} />
    </div>
  );
}

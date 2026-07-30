import { EditorTabs, ToggleRow } from '../ui/index.js';
import { TimerContentSection, TimerDesignSection, safeTimerEffect, safeTimerVariant } from './TimerBasicSection.jsx';
import './TimerEditor.css';

function TimerBottomSection({ s, page, updateBlock }) {
  const bottomBlock = page?.blocks?.find((block) => block?.type === 'bottombar');
  const timerEnabled = !!bottomBlock?.s?.timerEnabled;
  const bottomVisible = bottomBlock?.visible !== false;
  const variant = safeTimerVariant(s.timerVariant);
  const effect = safeTimerEffect(s);
  const variantLabel = ({ minimal: '클린', flat: '카드', block: '프로모션' })[variant] || '클린';
  const effectLabel = ({ none: '없음', slide: '슬라이드', flip: '플립', pulse: '펄스', fire: '불꽃' })[effect] || '없음';

  return (
    <div className="timer-workflow-stack timer-workflow-bottom">
      <div className="timer-workflow-intro">
        <strong>같은 타이머를 하단 고정 영역에도 표시합니다.</strong>
        <span>문구·시간·색상·스타일·효과는 위 타이머 설정을 자동으로 따라갑니다.</span>
      </div>

      <div className={`timer-bottom-link-preview ${timerEnabled ? 'is-on' : 'is-off'}`}>
        <div>
          <span>하단 표시 상태</span>
          <strong>{timerEnabled ? '표시 중' : '표시 안 함'}</strong>
        </div>
        <div>
          <span>적용 디자인</span>
          <strong>{variantLabel} · {effectLabel}</strong>
        </div>
        <div className={`timer-bottom-mini timer-bottom-mini-${variant} timer-bottom-mini-effect-${effect}`} aria-hidden="true">
          <span>{String(s.label ?? '혜택 마감까지').slice(0, 14) || '타이머'}</span>
          <b>08:24:36</b>
        </div>
      </div>

      <ToggleRow
        label="하단 고정 영역에도 타이머 표시"
        checked={timerEnabled}
        disabled={!bottomBlock || typeof updateBlock !== 'function'}
        onChange={(checked) => {
          if (!bottomBlock || typeof updateBlock !== 'function') return;
          updateBlock(bottomBlock.id, { timerEnabled: checked });
        }}
      />

      {!bottomBlock && (
        <p className="timer-workflow-note is-warning">하단 고정 버튼 블록을 먼저 추가해야 이 기능을 사용할 수 있습니다.</p>
      )}
      {bottomBlock && !bottomVisible && (
        <p className="timer-workflow-note is-warning">하단 고정 버튼 블록이 숨김 상태라 공개 화면에는 표시되지 않습니다.</p>
      )}
      {bottomBlock && (
        <p className="timer-workflow-note">버튼과 타이머를 함께 켜도 모바일 화면 높이에 맞춰 자동으로 컴팩트하게 배치됩니다.</p>
      )}
    </div>
  );
}

export default function TimerEditor({ s, set, page, updateBlock }) {
  return (
    <EditorTabs
      defaultTab="basic"
      tabs={[
        {
          id: 'basic',
          label: '기본',
          content: <TimerContentSection s={s} set={set} />,
        },
        {
          id: 'design',
          label: '디자인',
          content: <TimerDesignSection s={s} set={set} />,
        },
        {
          id: 'bottom',
          label: '하단 고정',
          content: <TimerBottomSection s={s} page={page} updateBlock={updateBlock} />,
        },
      ]}
    />
  );
}

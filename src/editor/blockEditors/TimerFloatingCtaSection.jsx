import { EditorField, ToggleRow } from '../ui/index.js';
import { timerFloatLabel } from './timerEditorModel.js';

export default function TimerFloatingCtaSection({ s, set }) {
  return (
    <>
      <ToggleRow label="하단 CTA 표시" description="타이머를 하단 고정 버튼과 함께 노출합니다." checked={Boolean(s.floatOnBottom)} onChange={(value) => set({ floatOnBottom: value })} />
      {s.floatOnBottom && (
        <EditorField label="표시 문구">
          <input value={timerFloatLabel(s)} onChange={(event) => set({ floatLabel: event.target.value })} />
        </EditorField>
      )}
    </>
  );
}
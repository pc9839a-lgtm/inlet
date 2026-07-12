import { ToggleRow } from '../ui/index.js';

export default function BottomBarTimerSection({ enabled, onChange }) {
  return (
    <ToggleRow
      label="타이머 표시"
      description="하단 고정 버튼에 타이머 정보를 함께 표시합니다."
      checked={Boolean(enabled)}
      onChange={onChange}
    />
  );
}
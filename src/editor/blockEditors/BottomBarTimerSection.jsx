import { ToggleRow } from '../ui/index.js';

export default function BottomBarTimerSection({ enabled, onChange }) {
  return (
    <ToggleRow
      label="타이머 표시"
      checked={Boolean(enabled)}
      onChange={onChange}
    />
  );
}
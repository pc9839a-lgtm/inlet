import { Step, Toggle } from '../controls.jsx';

export default function BottomBarTimerSection({ enabled, onChange }) {
  return (
    <Step title="타이머" icon="2">
      <Toggle label="타이머 표시" checked={!!enabled} onChange={onChange} />
    </Step>
  );
}
import { SegmentedControl } from '../ui/index.js';
import BottomBarButtonCard from './BottomBarButtonCard.jsx';

const countOptions = [
  { value: '1', label: '1개' },
  { value: '2', label: '2개' },
  { value: '3', label: '3개' },
];

export default function BottomBarBasicSection({ count, buttons, page, onCountChange, onButtonChange }) {
  return (
    <>
      <SegmentedControl label="버튼 개수" value={String(count)} onChange={onCountChange} options={countOptions} />
      <div className="bottom-button-list compact editor-v2-control-list">
        {buttons.map((button, index) => (
          <BottomBarButtonCard key={button.id || index} button={button} index={index} page={page} onChange={(patch) => onButtonChange(index, patch)} />
        ))}
      </div>
    </>
  );
}
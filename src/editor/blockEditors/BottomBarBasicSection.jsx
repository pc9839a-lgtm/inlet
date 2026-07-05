import { Choice, Step } from '../controls.jsx';
import BottomBarButtonCard from './BottomBarButtonCard.jsx';

const countOptions = [["1", '1개'], ["2", '2개'], ["3", '3개']];

export default function BottomBarBasicSection({ count, buttons, page, onCountChange, onButtonChange }) {
  return (
    <Step title="기본" icon="1" open>
      <Choice label="개수" value={String(count)} onChange={onCountChange} options={countOptions} />
      <div className="bottom-button-list compact">
        {buttons.map((button, index) => (
          <BottomBarButtonCard
            key={button.id || index}
            button={button}
            index={index}
            page={page}
            onChange={(patch) => onButtonChange(index, patch)}
          />
        ))}
      </div>
    </Step>
  );
}
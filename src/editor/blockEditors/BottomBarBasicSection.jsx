import { EditorList, SegmentedControl } from '../ui/index.js';
import BottomBarButtonCard from './BottomBarButtonCard.jsx';

const BUTTON_COUNT_LABEL = '\uBC84\uD2BC \uAC1C\uC218';
const BUTTON_LABEL = '\uBC84\uD2BC';

const countOptions = [
  { value: '1', label: '1\uAC1C' },
  { value: '2', label: '2\uAC1C' },
  { value: '3', label: '3\uAC1C' },
];

export default function BottomBarBasicSection({ count, buttons, page, onCountChange, onButtonChange }) {
  const editorItems = buttons.map((button, index) => ({
    ...button,
    id: `bottom-button-${index}`,
  }));

  return (
    <>
      <SegmentedControl label={BUTTON_COUNT_LABEL} value={String(count)} onChange={onCountChange} options={countOptions} />
      <EditorList
        items={editorItems}
        getTitle={(button, index) => button.label || `${BUTTON_LABEL} ${index + 1}`}
        getIcon={(button, index) => button.icon || index + 1}
        renderItem={(button, index) => (
          <BottomBarButtonCard
            button={button}
            index={index}
            page={page}
            onChange={(patch) => onButtonChange(index, patch)}
          />
        )}
        canRemove={() => false}
      />
    </>
  );
}

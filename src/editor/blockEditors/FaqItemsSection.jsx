import { AddButton, LineList, Step } from '../controls.jsx';
import FaqItemEditor from './FaqItemEditor.jsx';

export default function FaqItemsSection({ items, onAdd, onChange, onRemove }) {
  return (
    <Step title="질문" icon="2" open>
      <LineList>
        {items.map((item, index) => (
          <FaqItemEditor
            key={item.id}
            item={item}
            index={index}
            onChange={(patch) => onChange(item.id, patch)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </LineList>
      <AddButton onClick={onAdd} />
    </Step>
  );
}
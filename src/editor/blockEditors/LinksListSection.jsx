import { AddButton, LineList } from '../controls.jsx';
import LinkItemEditor from './LinkItemEditor.jsx';

export default function LinksListSection({ items, page, TargetControl, onUpdate, onRemove, onAdd }) {
  return (
    <>
      <LineList>
        {items.map((item) => (
          <LinkItemEditor
            key={item.id}
            item={item}
            page={page}
            TargetControl={TargetControl}
            onUpdate={(patch) => onUpdate(item.id, patch)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </LineList>
      <AddButton onClick={onAdd} />
    </>
  );
}
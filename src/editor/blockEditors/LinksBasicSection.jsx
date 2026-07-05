import { Field, Step } from '../controls.jsx';
import LinksListSection from './LinksListSection.jsx';

export default function LinksBasicSection({ title, items, page, TargetControl, onTitleChange, onUpdateItem, onRemoveItem, onAddItem }) {
  return (
    <Step title="기본" icon="1" open>
      <Field label="제목" value={title} onChange={(value) => onTitleChange(value)} />
      <LinksListSection
        items={items}
        page={page}
        TargetControl={TargetControl}
        onUpdate={onUpdateItem}
        onRemove={onRemoveItem}
        onAdd={onAddItem}
      />
    </Step>
  );
}
import { EditorStack } from '../controls.jsx';
import LinksBasicSection from './LinksBasicSection.jsx';
import useLinksItems from './useLinksItems.js';

export default function LinksEditor({ s, set, page, TargetControl }) {
  const { items, updateItem, removeItem, addItem } = useLinksItems({ s, set });

  return (
    <EditorStack>
      <LinksBasicSection
        title={s.title}
        items={items}
        page={page}
        TargetControl={TargetControl}
        onTitleChange={(title) => set({ title })}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onAddItem={addItem}
      />
    </EditorStack>
  );
}
import { EditorStack } from '../controls.jsx';
import FaqBasicSection from './FaqBasicSection.jsx';
import FaqItemsSection from './FaqItemsSection.jsx';
import useFaqItems from './useFaqItems.js';

export default function FaqEditor({ s, set }) {
  const { items, updateItem, removeItem, addItem } = useFaqItems({ s, set });

  return (
    <EditorStack>
      <FaqBasicSection s={s} set={set} />
      <FaqItemsSection items={items} onAdd={addItem} onChange={updateItem} onRemove={removeItem} />
    </EditorStack>
  );
}
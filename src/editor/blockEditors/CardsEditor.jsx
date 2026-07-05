import { EditorStack } from '../controls.jsx';
import CardsBasicSection from './CardsBasicSection.jsx';
import CardsItemsSection from './CardsItemsSection.jsx';
import useCardsItems from './useCardsItems.js';

export default function CardsEditor({ s, set }) {
  const { items, changeItem, deleteItem, addItem } = useCardsItems({ s, set });

  return (
    <EditorStack>
      <CardsBasicSection title={s.title} desc={s.desc} onChange={set} />
      <CardsItemsSection
        items={items}
        onChangeItem={changeItem}
        onRemoveItem={deleteItem}
        onAddItem={addItem}
      />
    </EditorStack>
  );
}
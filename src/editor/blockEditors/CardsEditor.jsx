import { EditorList, EditorTabs } from '../ui/index.js';
import CardsBasicSection from './CardsBasicSection.jsx';
import CardsItemFields from './CardsItemFields.jsx';
import useCardsItems from './useCardsItems.js';

export default function CardsEditor({ s, set }) {
  const { items, changeItem, deleteItem, addItem } = useCardsItems({ s, set });

  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: <CardsBasicSection title={s.title} desc={s.desc} onChange={set} />,
        },
        {
          id: 'items',
          label: '카드 목록',
          content: (
            <EditorList
              items={items}
              getTitle={(item, index) => item.title || `카드 ${index + 1}`}
              getIcon={(_, index) => index + 1}
              renderItem={(item) => <CardsItemFields item={item} onChange={(patch) => changeItem(item.id, patch)} />}
              onRemove={(item) => deleteItem(item.id)}
              onAdd={addItem}
              addLabel="카드 추가"
              emptyText="카드가 없습니다."
            />
          ),
        },
      ]}
    />
  );
}

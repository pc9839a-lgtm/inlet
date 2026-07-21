import { EditorField, EditorList, EditorTabs } from '../ui/index.js';
import FaqItemFields from './FaqItemFields.jsx';
import useFaqItems from './useFaqItems.js';
import { FaqStylePanel } from './WidgetStylePanels.jsx';

export default function FaqEditor({ s, set }) {
  const { items, updateItem, removeItem, addItem } = useFaqItems({ s, set });

  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: (
            <EditorField label="제목">
              <input value={s.title ?? '자주 묻는 질문'} onChange={(event) => set({ title: event.target.value })} />
            </EditorField>
          ),
        },
        {
          id: 'items',
          label: '질문 목록',
          content: (
            <EditorList
              items={items}
              getTitle={(item, index) => item.q || `질문 ${index + 1}`}
              getIcon={(_, index) => index + 1}
              renderItem={(item) => <FaqItemFields item={item} onChange={(patch) => updateItem(item.id, patch)} />}
              onRemove={(item) => removeItem(item.id)}
              onAdd={addItem}
              addLabel="질문 추가"
              emptyText="질문이 없습니다."
            />
          ),
        },
        {
          id: 'style',
          label: '스타일',
          content: <FaqStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}

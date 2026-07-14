import { EditorField, EditorList, EditorTabs } from '../ui/index.js';
import { getLinkBadge, getLinkIcon } from './LinkItemDisplay.jsx';
import LinkItemFields from './LinkItemFields.jsx';
import useLinksItems from './useLinksItems.js';
import { LinksStylePanel } from './WidgetStylePanels.jsx';

export default function LinksEditor({ s, set, page, TargetControl }) {
  const { items, updateItem, removeItem, addItem } = useLinksItems({ s, set });

  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: (
            <EditorField label="제목">
              <input value={s.title || ''} onChange={(event) => set({ title: event.target.value })} />
            </EditorField>
          ),
        },
        {
          id: 'items',
          label: '링크 목록',
          content: (
            <EditorList
              items={items}
              getTitle={(item, index) => item.label || `링크 ${index + 1}`}
              getIcon={(item) => getLinkIcon(item)}
              getBadge={(item) => getLinkBadge(item)}
              renderItem={(item) => <LinkItemFields item={item} page={page} TargetControl={TargetControl} onUpdate={(patch) => updateItem(item.id, patch)} />}
              onRemove={(item) => removeItem(item.id)}
              onAdd={addItem}
              addLabel="링크 추가"
              emptyText="링크가 없습니다."
            />
          ),
        },
        {
          id: 'style',
          label: '스타일',
          content: <LinksStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}

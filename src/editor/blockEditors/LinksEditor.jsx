import { EditorField, EditorList } from '../ui/index.js';
import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import { getLinkBadge, getLinkIcon } from './LinkItemDisplay.jsx';
import LinkItemFields from './LinkItemFields.jsx';
import useLinksItems from './useLinksItems.js';
import { LinksStylePanel } from './WidgetStylePanels.jsx';
import './LinksEditor.css';

// Names, targets and ordering are one task; a hidden second "links" tab
// made the most frequent action needlessly difficult to discover.
export default function LinksEditor({ s, set, page, TargetControl }) {
  const { items, updateItem, removeItem, addItem } = useLinksItems({ s, set });
  return (
    <div className="links-editor-v3 editor-task-flow" data-editor-task="links">
      <section className="editor-task-section" aria-label="링크 블록 제목">
        <div className="editor-task-heading"><h3>목록 제목</h3></div>
        <EditorField label="제목">
          <input value={s.title || ''} onChange={(event) => set({ title: event.target.value })} />
        </EditorField>
      </section>
      <section className="editor-task-section links-items-task" aria-label="링크 추가와 수정">
        <div className="editor-task-heading"><h3>버튼과 연결</h3><span>{items.length}개</span></div>
        <EditorList
          items={items}
          getTitle={(item, index) => item.label || `링크 ${index + 1}`}
          getIcon={(item) => getLinkIcon(item)}
          getBadge={(item) => getLinkBadge(item)}
          renderItem={(item, index) => <LinkItemFields item={item} index={index} page={page} TargetControl={TargetControl} onUpdate={(patch) => updateItem(item.id, patch)} />}
          onRemove={(item) => removeItem(item.id)}
          onAdd={addItem}
          addLabel="링크 추가"
          emptyText="링크가 없습니다."
          detailPlacement="panel"
        />
      </section>
      <section className="editor-task-section editor-task-secondary" aria-label="링크 디자인">
        <InspectorDisclosure label="디자인 조정" className="links-editor-design">
          <LinksStylePanel s={s} set={set} />
        </InspectorDisclosure>
      </section>
    </div>
  );
}

import { FileText, Link as LinkIcon } from 'lucide-react';
import { EditorField, EditorList, EditorSection } from '../ui/index.js';
import { getLinkBadge, getLinkIcon } from './LinkItemDisplay.jsx';
import LinkItemFields from './LinkItemFields.jsx';
import useLinksItems from './useLinksItems.js';

export default function LinksEditor({ s, set, page, TargetControl }) {
  const { items, updateItem, removeItem, addItem } = useLinksItems({ s, set });

  return (
    <>
      <EditorSection id="content" title="내용" description="링크 영역의 제목을 입력합니다." icon={FileText} defaultOpen>
        <EditorField label="제목">
          <input value={s.title || ''} onChange={(event) => set({ title: event.target.value })} />
        </EditorField>
      </EditorSection>
      <EditorSection id="items" title="링크 목록" description="버튼 이름과 이동할 위치를 설정합니다." icon={LinkIcon} defaultOpen>
        <EditorList
          items={items}
          getTitle={(item, index) => item.label || `링크 ${index + 1}`}
          getIcon={(item) => getLinkIcon(item)}
          getBadge={(item) => getLinkBadge(item)}
          renderItem={(item) => <LinkItemFields item={item} page={page} TargetControl={TargetControl} onUpdate={(patch) => updateItem(item.id, patch)} />}
          onRemove={(item) => removeItem(item.id)}
          onAdd={addItem}
          addLabel="링크 추가"
          emptyText="아직 링크가 없습니다. 첫 링크를 추가해 보세요."
        />
      </EditorSection>
    </>
  );
}
import { FileText, HelpCircle } from 'lucide-react';
import { EditorField, EditorList, EditorSection } from '../ui/index.js';
import FaqItemFields from './FaqItemFields.jsx';
import useFaqItems from './useFaqItems.js';

export default function FaqEditor({ s, set }) {
  const { items, updateItem, removeItem, addItem } = useFaqItems({ s, set });

  return (
    <>
      <EditorSection id="content" title="내용" description="FAQ 영역의 제목을 입력합니다." icon={FileText} defaultOpen>
        <EditorField label="제목">
          <input value={s.title || '자주 묻는 질문'} onChange={(event) => set({ title: event.target.value })} />
        </EditorField>
      </EditorSection>
      <EditorSection id="items" title="질문과 답변" description="자주 묻는 질문을 추가하고 답변을 작성합니다." icon={HelpCircle} defaultOpen>
        <EditorList
          items={items}
          getTitle={(item, index) => item.q || `질문 ${index + 1}`}
          getIcon={(_, index) => index + 1}
          renderItem={(item) => <FaqItemFields item={item} onChange={(patch) => updateItem(item.id, patch)} />}
          onRemove={(item) => removeItem(item.id)}
          onAdd={addItem}
          addLabel="질문 추가"
          emptyText="아직 질문이 없습니다. 첫 질문을 추가해 보세요."
        />
      </EditorSection>
    </>
  );
}
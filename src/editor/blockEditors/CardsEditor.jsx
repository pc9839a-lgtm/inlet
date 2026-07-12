import { FileText, LayoutGrid } from 'lucide-react';
import { EditorList, EditorSection } from '../ui/index.js';
import CardsBasicSection from './CardsBasicSection.jsx';
import CardsItemFields from './CardsItemFields.jsx';
import useCardsItems from './useCardsItems.js';

export default function CardsEditor({ s, set }) {
  const { items, changeItem, deleteItem, addItem } = useCardsItems({ s, set });

  return (
    <>
      <EditorSection id="content" title="내용" description="카드 영역의 제목과 설명을 입력합니다." icon={FileText} defaultOpen>
        <CardsBasicSection title={s.title} desc={s.desc} onChange={set} />
      </EditorSection>
      <EditorSection id="items" title="카드 목록" description="카드를 추가하고 각 카드의 내용을 편집합니다." icon={LayoutGrid} defaultOpen>
        <EditorList
          items={items}
          getTitle={(item, index) => item.title || `카드 ${index + 1}`}
          getIcon={(_, index) => index + 1}
          renderItem={(item) => <CardsItemFields item={item} onChange={(patch) => changeItem(item.id, patch)} />}
          onRemove={(item) => deleteItem(item.id)}
          onAdd={addItem}
          addLabel="카드 추가"
          emptyText="아직 카드가 없습니다. 첫 카드를 추가해 보세요."
        />
      </EditorSection>
    </>
  );
}
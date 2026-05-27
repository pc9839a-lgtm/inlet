import { AddButton, Choice, Danger, EditorStack, Field, MiniDetail, Step } from '../controls.jsx';
import { uid } from '../../lib/pageModel.js';
import RichField from '../RichField.jsx';

export default function CardsEditor({ s, set }) {
  const items = Array.isArray(s.items) ? s.items : [];
  const updateItem = (id, patch) => set({ items: items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const removeItem = (id) => set({ items: items.filter((item) => item.id !== id) });
  const addItem = () => set({ items: [...items, { id: uid(), eyebrow: String(items.length + 1).padStart(2, '0'), title: '새 카드', body: '내용을 입력하세요.' }] });

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <RichField label="제목" value={s.title} onChange={(v) => set({ title: v })} />
        <RichField label="설명" value={s.desc} onChange={(v) => set({ desc: v })} />
      </Step>

      <Step title="카드" icon="2" open>
        {items.map((item, index) => (
          <MiniDetail key={item.id} icon={index + 1} title={item.title || `카드 ${index + 1}`}>
            <Field label="라벨" value={item.eyebrow || ''} onChange={(v) => updateItem(item.id, { eyebrow: v })} />
            <RichField label="제목" value={item.title || ''} onChange={(v) => updateItem(item.id, { title: v })} />
            <RichField label="내용" value={item.body || ''} onChange={(v) => updateItem(item.id, { body: v })} />
            <Danger onClick={() => removeItem(item.id)} />
          </MiniDetail>
        ))}
        <AddButton onClick={addItem} />
      </Step>

      <Step title="디자인" icon="3">
        <Choice label="형태" value={s.layout || 'grid'} onChange={(v) => set({ layout: v })} options={[['grid', '그리드'], ['stack', '목록'], ['steps', '단계']]} />
        <Choice label="톤" value={s.tone || 'soft'} onChange={(v) => set({ tone: v })} options={[['soft', '소프트'], ['solid', '강조'], ['outline', '라인']]} />
        <Choice label="정렬" value={s.align || 'left'} onChange={(v) => set({ align: v })} options={[['left', '왼쪽'], ['center', '중앙']]} />
        <Choice label="열" value={String(Math.min(2, Number(s.columns || 2)))} onChange={(v) => set({ columns: Number(v) })} options={[['1', '1'], ['2', '2']]} />
      </Step>
    </EditorStack>
  );
}

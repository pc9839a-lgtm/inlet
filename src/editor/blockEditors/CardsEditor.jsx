import { AddButton, Danger, EditorStack, Field, MiniDetail, Step } from '../controls.jsx';
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
    </EditorStack>
  );
}

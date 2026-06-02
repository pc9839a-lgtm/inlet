import { EditorStack, Step } from '../controls.jsx';
import RichField from '../RichField.jsx';

export default function TextEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <RichField label="제목" value={s.title} onChange={(v) => set({ title: v })} />
        <RichField label="설명" value={s.body} onChange={(v) => set({ body: v })} />
      </Step>
    </EditorStack>
  );
}

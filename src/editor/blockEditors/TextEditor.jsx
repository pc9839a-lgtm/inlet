import { Choice, EditorStack, Step } from '../controls.jsx';
import { alignOptions, sizeOptions } from '../editorOptions.js';
import RichField from '../RichField.jsx';

const layoutHelp = {
  plain: '기본: 배경 없이 본문만 배치합니다.',
  card: '카드: 흰 박스와 테두리로 콘텐츠를 묶습니다.',
  notice: '알림: 강조 배너로 중요한 문구를 보여줍니다.',
};

export default function TextEditor({ s, set }) {
  const layout = s.layout || 'plain';

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <RichField label="제목" value={s.title} onChange={(v) => set({ title: v })} />
        <RichField label="설명" value={s.body} onChange={(v) => set({ body: v })} />
      </Step>

      <Step title="표시" icon="2">
        <Choice label="정렬" value={s.align} onChange={(v) => set({ align: v })} options={alignOptions} />
        <Choice label="크기" value={s.size} onChange={(v) => set({ size: v })} options={sizeOptions} />
      </Step>

      <Step title="디자인" icon="3">
        <Choice label="형태" value={layout} onChange={(v) => set({ layout: v })} options={[['plain', '기본'], ['card', '카드'], ['notice', '알림']]} />
        <div className="text-layout-help">{layoutHelp[layout] || layoutHelp.plain}</div>
      </Step>
    </EditorStack>
  );
}

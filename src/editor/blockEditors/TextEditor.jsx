import RichField from '../RichField.jsx';
import { EditorTabs } from '../ui/index.js';
import { TextStylePanel } from './WidgetStylePanels.jsx';

export default function TextEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: (
            <>
              <RichField
                variant="v2"
                label="제목"
                placeholder="제목을 입력하세요"
                value={s.title}
                onChange={(value) => set({ title: value })}
              />
              <RichField
                variant="v2"
                label="본문"
                placeholder="본문 내용을 입력하세요"
                value={s.body}
                onChange={(value) => set({ body: value })}
              />
            </>
          ),
        },
        {
          id: 'style',
          label: '스타일',
          content: <TextStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}

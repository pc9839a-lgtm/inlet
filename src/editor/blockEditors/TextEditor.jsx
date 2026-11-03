import RichField from '../RichField.jsx';
import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import { TextStylePanel } from './WidgetStylePanels.jsx';
import { WidgetSpacingControls } from './WidgetSpacingControls.jsx';
import './TextEditor.css';

export default function TextEditor({ s, set }) {
  return (
    <div className="text-editor-flow">
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
      <InspectorDisclosure label="디자인" className="text-editor-design" bodyClassName="text-editor-design-controls" defaultOpen>
        <TextStylePanel s={s} set={set} />
      </InspectorDisclosure>
      <WidgetSpacingControls s={s} set={set} />
    </div>
  );
}

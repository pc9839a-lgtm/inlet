import { EditorField, ToggleRow } from '../ui/index.js';
import { BottomEmojiPicker } from './BottomEmojiPicker.jsx';
import { BottomLinkCompact } from './BottomLinkCompact.jsx';

// The first two controls match the user's actual job: what the button says,
// and where it goes. Visibility and decoration are secondary.
export default function BottomBarButtonCard({ button, index, page, onChange }) {
  return (
    <div className="bottom-button-editor-body editor-v2-control-list editor-task-flow">
      <div className="bottom-button-primary-task">
        <EditorField label="버튼 문구">
          <input
            value={button.label || ''}
            onChange={(event) => onChange({ label: event.target.value })}
            aria-label={`버튼 ${index + 1} 문구`}
            data-bottom-button-label-index={index}
            placeholder={`버튼 ${index + 1}`}
          />
        </EditorField>
        <BottomLinkCompact button={button} index={index} page={page} onChange={onChange} />
      </div>
      <div className="bottom-button-secondary-task" aria-label="버튼 표시와 아이콘">
        <ToggleRow
          label="버튼 표시"
          checked={button.enabled !== false}
          onChange={(enabled) => onChange({ enabled })}
        />
        <EditorField label="아이콘">
          <BottomEmojiPicker value={button.icon || ''} onChange={(icon) => onChange({ icon })} />
        </EditorField>
      </div>
    </div>
  );
}

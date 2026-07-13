import { EditorField, ToggleRow } from '../ui/index.js';
import { BottomEmojiPicker } from './BottomEmojiPicker.jsx';
import { BottomLinkCompact } from './BottomLinkCompact.jsx';

const VISIBLE_LABEL = '\uBC84\uD2BC \uD45C\uC2DC';
const ICON_LABEL = '\uC544\uC774\uCF58';
const TEXT_LABEL = '\uBC84\uD2BC \uBB38\uAD6C';
const BUTTON_LABEL = '\uBC84\uD2BC';

export default function BottomBarButtonCard({ button, index, page, onChange }) {
  return (
    <div className="bottom-button-editor-body editor-v2-control-list">
      <ToggleRow
        label={VISIBLE_LABEL}
        checked={button.enabled !== false}
        onChange={(enabled) => onChange({ enabled })}
      />
      <EditorField label={ICON_LABEL}>
        <BottomEmojiPicker value={button.icon || ''} onChange={(icon) => onChange({ icon })} />
      </EditorField>
      <EditorField label={TEXT_LABEL}>
        <input
          value={button.label || ''}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder={`${BUTTON_LABEL} ${index + 1}`}
        />
      </EditorField>
      <BottomLinkCompact button={button} page={page} onChange={onChange} />
    </div>
  );
}

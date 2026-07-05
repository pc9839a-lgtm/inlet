import { BottomEmojiPicker } from './BottomEmojiPicker.jsx';
import { BottomLinkCompact } from './BottomLinkCompact.jsx';

export default function BottomBarButtonCard({ button, index, page, onChange }) {
  return (
    <div className={`bottom-button-card compact ${button.enabled === false ? 'off' : ''}`}>
      <div className="bottom-button-main-row">
        <button
          type="button"
          className={`mini-on ${button.enabled !== false ? 'active' : ''}`}
          onClick={() => onChange({ enabled: !(button.enabled !== false) })}
        >
          {button.enabled !== false ? 'ON' : 'OFF'}
        </button>
        <BottomEmojiPicker value={button.icon || ''} onChange={(icon) => onChange({ icon })} />
        <input
          className="bottom-label-input"
          value={button.label || ''}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder={`버튼 ${index + 1}`}
        />
      </div>
      <BottomLinkCompact button={button} page={page} onChange={onChange} />
    </div>
  );
}
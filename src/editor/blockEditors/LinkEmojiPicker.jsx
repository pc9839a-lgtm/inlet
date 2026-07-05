import { LINK_EMOJIS } from './linksEditorModel.js';

export default function LinkEmojiPicker({ item, onChange }) {
  return (
    <div className="emoji-simple-row">
      {LINK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={(item.emoji || '') === emoji ? 'active' : ''}
          onClick={() => onChange({ emoji })}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
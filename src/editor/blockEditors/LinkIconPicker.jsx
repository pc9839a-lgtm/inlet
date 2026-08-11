import LinkEmojiPicker from './LinkEmojiPicker.jsx';
import LinkIconModeButtons from './LinkIconModeButtons.jsx';
import LinkThumbPicker from './LinkThumbPicker.jsx';
import './LinkIconPicker.css';

export function LinkIconPicker({ item, onChange }) {
  const mode = item.iconMode || 'emoji';

  return (
    <div className="link-icon-simple-v2" data-icon-mode={mode}>
      <LinkIconModeButtons mode={mode} onChange={onChange} />
      {mode === 'emoji' && <LinkEmojiPicker item={item} onChange={onChange} />}
      {mode === 'thumb' && <LinkThumbPicker item={item} onChange={onChange} />}
    </div>
  );
}

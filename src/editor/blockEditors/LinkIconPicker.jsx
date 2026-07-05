import LinkEmojiPicker from './LinkEmojiPicker.jsx';
import LinkIconModeButtons from './LinkIconModeButtons.jsx';
import LinkThumbPicker from './LinkThumbPicker.jsx';

export function LinkIconPicker({ item, onChange }) {
  const mode = item.iconMode || 'emoji';

  return (
    <div className="link-icon-simple">
      <LinkIconModeButtons mode={mode} onChange={onChange} />
      {mode === 'emoji' && <LinkEmojiPicker item={item} onChange={onChange} />}
      {mode === 'thumb' && <LinkThumbPicker item={item} onChange={onChange} />}
    </div>
  );
}
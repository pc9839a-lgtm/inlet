import { useState } from 'react';
import { BOTTOM_EMOJIS } from './bottomBarEditorModel.js';

export function BottomEmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bottom-emoji-picker">
      <button type="button" className={`bottom-emoji-trigger ${value ? '' : 'empty'}`} onClick={() => setOpen(!open)}>{value || '없음'}</button>
      {open && (
        <div className="bottom-emoji-panel">
          <button className="none" type="button" onClick={() => { onChange(''); setOpen(false); }}>없음</button>
          {BOTTOM_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => { onChange(emoji); setOpen(false); }}>{emoji}</button>
          ))}
        </div>
      )}
    </div>
  );
}

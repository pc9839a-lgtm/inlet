import { useState } from 'react';
import { Choice, EditorStack, Field, Step, Toggle } from '../controls.jsx';
import { META } from '../../config/blockMeta.jsx';
import { normalizeButtons } from '../../lib/blockButtons.js';

function normalizeTarget(target, blocks = []) {
  const raw = String(target || '');
  if (raw.startsWith('block:')) {
    const id = raw.slice(6);
    return blocks.some((b) => b.id === id) ? raw : (blocks[0]?.id ? `block:${blocks[0].id}` : 'hero');
  }
  if (['url', 'phone'].includes(raw)) return raw;
  const matched = blocks.find((b) => b.type === raw);
  return matched?.id ? `block:${matched.id}` : (blocks[0]?.id ? `block:${blocks[0].id}` : raw || 'hero');
}

const BOTTOM_EMOJIS = ['💬','📅','📞','🔗','🏠','📍','💳','🎁','⭐','📝','✅','🚀','💡','📦','🛒','👤'];

function BottomEmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bottom-emoji-picker">
      <button type="button" className={`bottom-emoji-trigger ${value ? '' : 'empty'}`} onClick={()=>setOpen(!open)}>{value || '없음'}</button>
      {open && (
        <div className="bottom-emoji-panel">
          <button className="none" type="button" onClick={()=>{onChange(''); setOpen(false);}}>없음</button>
          {BOTTOM_EMOJIS.map((emoji)=>(
            <button key={emoji} type="button" onClick={()=>{onChange(emoji); setOpen(false);}}>{emoji}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function BottomLinkCompact({ button, page, onChange }) {
  const blocks = (page?.blocks || []).filter((b) => b.type !== 'bottombar');
  const normalized = normalizeTarget(button.target, blocks);
  const savedWidget = normalizeTarget(button.lastWidgetTarget, blocks);
  const first = blocks[0]?.id ? `block:${blocks[0].id}` : 'hero';
  const currentWidget = normalized.startsWith('block:') ? normalized : (savedWidget.startsWith('block:') ? savedWidget : first);
  const mode = normalized.startsWith('block:') || (!['url','phone'].includes(button.target || '')) ? 'widget' : button.target;

  const setMode = (next) => {
    if (next === 'url') {
      onChange({
        target: 'url',
        url: button.url && !String(button.url).startsWith('tel:') ? button.url : 'https://',
        lastWidgetTarget: currentWidget,
      });
      return;
    }

    if (next === 'phone') {
      onChange({
        target: 'phone',
        url: button.url && String(button.url).startsWith('tel:') ? button.url : 'tel:01000000000',
        lastWidgetTarget: currentWidget,
      });
      return;
    }

    onChange({ target: currentWidget, url: '', lastWidgetTarget: currentWidget });
  };

  return (
    <div className="bottom-link-compact bottom-link-tabs">
      <span>이동</span>
      <div className="bottom-link-controls">
        <div className="bottom-link-modes">
          {[['widget','위젯'],['url','링크'],['phone','전화']].map(([key, text]) => (
            <button key={key} type="button" className={mode===key?'active':''} onClick={()=>setMode(key)}>{text}</button>
          ))}
        </div>

        {mode === 'widget' && (
          <select
            value={currentWidget}
            onChange={(e)=>onChange({target:e.target.value,url:'',lastWidgetTarget:e.target.value})}
          >
            {blocks.map((b, idx) => {
              const meta = META[b.type] || META.text;
              return <option key={b.id} value={`block:${b.id}`}>{idx + 1}. {meta.label}</option>;
            })}
          </select>
        )}

        {mode === 'url' && (
          <input value={button.url || ''} placeholder="https://" onChange={(e)=>onChange({target:'url',url:e.target.value,lastWidgetTarget:currentWidget})}/>
        )}

        {mode === 'phone' && (
          <input value={button.url || ''} placeholder="tel:01000000000" onChange={(e)=>onChange({target:'phone',url:e.target.value,lastWidgetTarget:currentWidget})}/>
        )}
      </div>
    </div>
  );
}

export default function BottomBarEditor({ s, set, page }) {
  const themeButtonColor = page?.theme?.accent || '#111827';
  const count = Math.max(1, Math.min(3, Number(s.count || 1)));
  const buttons = normalizeButtons(s.buttons, count);

  const update = (idx, patch) => {
    const next = normalizeButtons(s.buttons, count);
    next[idx] = { ...next[idx], ...patch };
    set({ buttons: next });
  };

  const setCount = (value) => {
    const nextCount = Number(value);
    set({ count: nextCount, buttons: normalizeButtons(buttons, nextCount) });
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Choice label="개수" value={String(count)} onChange={setCount} options={[['1','1개'],['2','2개'],['3','3개']]}/>
        <div className="bottom-button-list compact">
          {buttons.slice(0,count).map((b,i)=>(
            <div className={`bottom-button-card compact ${b.enabled===false?'off':''}`} key={b.id || i}>
              <div className="bottom-button-main-row">
                <button type="button" className={`mini-on ${b.enabled!==false?'active':''}`} onClick={()=>update(i,{enabled:!(b.enabled!==false)})}>
                  {b.enabled!==false ? 'ON' : 'OFF'}
                </button>
                <BottomEmojiPicker value={b.icon || ''} onChange={(icon)=>update(i,{icon})}/>
                <input className="bottom-label-input" value={b.label || ''} onChange={(e)=>update(i,{label:e.target.value})} placeholder={`버튼 ${i+1}`}/>
              </div>
              <BottomLinkCompact button={b} page={page} onChange={(patch)=>update(i,patch)}/>
            </div>
          ))}
        </div>
      </Step>


      <Step title="타이머" icon="2">
        <Toggle label="타이머 표시" checked={!!s.timerEnabled} onChange={(v)=>set({timerEnabled:v})}/>
      </Step>

      <Step title="디자인" icon="3">
        <div className="bottom-design-grid">
          <Choice label="형태" value={s.style || 'pill'} onChange={(v)=>set({style:v})} options={[['pill','둥근'],['box','박스']]}/>
          <div className="bottom-color-direct">
            <label><span>버튼색</span><input type="color" value={s.buttonColorMode === 'custom' ? (s.buttonColor || themeButtonColor) : themeButtonColor} onChange={(e)=>set({buttonColor:e.target.value, buttonColorMode:'custom'})}/><button type="button" className="global-color-reset" onClick={()=>set({buttonColorMode:'theme'})}>전역</button></label>
            <label><span>글자색</span><input type="color" value={s.buttonTextColor || '#ffffff'} onChange={(e)=>set({buttonTextColor:e.target.value})}/></label>
          </div>
        </div>
      </Step>
    </EditorStack>
  );
}


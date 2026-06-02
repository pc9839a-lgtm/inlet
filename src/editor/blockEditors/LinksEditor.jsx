import { useRef, useState } from 'react';
import { AddButton, Choice, EditorStack, Field, LineList, MiniDetail, Step, imageUploadError, storedImageInfo, warnImageStorageUse } from '../controls.jsx';
import { fetchLinkPreview, linkThumbnailFromUrl } from '../../lib/linkPreview.js';
import { pickSafe, uid } from '../../lib/pageModel.js';
import { notify } from '../../lib/uiFeedback.js';

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeLinkItem(item = {}) {
  const url = item.url || '';
  const thumb = item.thumb || linkThumbnailFromUrl(url);
  return {
    id: item.id || uid(),
    emoji: item.emoji ?? '🔗',
    iconMode: pickSafe(item.iconMode || 'emoji', ['none','emoji','thumb'], 'emoji'),
    thumb,
    label: item.label || '새 링크',
    target: item.target || 'url',
    url,
    lastWidgetTarget: item.lastWidgetTarget || '',
  };
}

function LinkIconPicker({ item, onChange }) {
  const emojis = ['💬','📅','📞','🔗','🏠','📍','🎁','✅','⭐','🛒','👤'];
  const mode = item.iconMode || 'emoji';
  const [loading, setLoading] = useState(false);
  const uploadRef = useRef(null);
  const thumbStorage = storedImageInfo(item.thumb);

  const autoThumb = async () => {
    setLoading(true);
    try {
      const preview = await fetchLinkPreview(item.url);
      const patch = { iconMode: 'thumb', thumb: preview.image || '' };
      if ((!item.label || item.label === '새 링크') && preview.title) patch.label = preview.title;
      onChange(patch);
    } finally {
      setLoading(false);
    }
  };

  const uploadThumb = async (file) => {
    if (!file) return;
    const error = imageUploadError(file);
    if (error) {
      notify(error, 'error');
      if (uploadRef.current) uploadRef.current.value = '';
      return;
    }
    warnImageStorageUse([file], '링크 썸네일');
    try {
      const dataUrl = await readFile(file);
      onChange({ iconMode: 'thumb', thumb: dataUrl });
    } catch (readError) {
      console.warn('Link thumbnail upload read failed:', readError);
      notify('썸네일 이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.', 'error');
    } finally {
      if (uploadRef.current) uploadRef.current.value = '';
    }
  };

  return (
    <div className="link-icon-simple">
      <div className="link-icon-mode">
        {[['none','없음'],['emoji','아이콘'],['thumb','썸네일']].map(([key,label])=>(
          <button key={key} type="button" className={mode === key ? 'active' : ''} onClick={()=>onChange({iconMode:key})}>{label}</button>
        ))}
      </div>

      {mode === 'emoji' && (
        <div className="emoji-simple-row">
          {emojis.map((emoji)=>(
            <button key={emoji} type="button" className={(item.emoji || '') === emoji ? 'active' : ''} onClick={()=>onChange({emoji})}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {mode === 'thumb' && (
        <div className="thumb-simple-row thumb-simple-row-v2">
          <div className="thumb-square">
            {item.thumb ? <img src={item.thumb} alt="" /> : <span>1:1</span>}
          </div>

          <div className="thumb-actions">
            <button type="button" onClick={autoThumb} disabled={loading}>{loading ? '확인중' : '자동'}</button>
            <button type="button" onClick={()=>uploadRef.current?.click()}>업로드</button>
            {item.thumb && <button type="button" className="ghost thumb-delete-action" onClick={()=>onChange({thumb:''})}>썸네일 삭제</button>}
          </div>
          {thumbStorage.stored && (
            <div className={`image-storage-cleanup compact ${thumbStorage.heavy ? 'warning' : ''}`}>
              <span>저장 썸네일 {thumbStorage.label}{thumbStorage.heavy ? ' · 용량 큼' : ''}</span>
              {thumbStorage.heavy && (
                <button type="button" onClick={()=>onChange({thumb:''})}>썸네일 제거</button>
              )}
            </div>
          )}

          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e)=>uploadThumb(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}

export default function LinksEditor({ s, set, page, TargetControl }) {
  const items = (s.items || []).map(normalizeLinkItem);
  const update = (id, patch) => {
    const next = items.map((it)=>{
      if (it.id !== id) return it;
      const merged = {...it, ...patch};
      if (patch.url) {
        merged.url = patch.url;
      }
      return merged;
    });
    set({ items: next });
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="제목" value={s.title} onChange={(v)=>set({title:v})}/>

        <LineList>
          {items.map((it)=>(
            <MiniDetail
              key={it.id}
              icon={it.iconMode === 'thumb' ? '▧' : it.iconMode === 'none' ? '—' : (it.emoji || '🔗')}
              title={it.label}
              badge={it.target === 'url' ? '링크' : it.target === 'phone' ? '전화' : '위젯'}
            >
              <div className="link-editor-simple">
                <Field label="이름" value={it.label} onChange={(v)=>update(it.id,{label:v})}/>
                <TargetControl
                  label="연결"
                  target={it.target || 'url'}
                  url={it.url}
                  lastWidgetTarget={it.lastWidgetTarget}
                  page={page}
                  onChange={(patch)=>update(it.id, patch)}
                />
                <LinkIconPicker item={it} onChange={(patch)=>update(it.id, patch)}/>
                <button type="button" className="simple-delete-btn" onClick={()=>set({items:items.filter((x)=>x.id!==it.id)})}>삭제</button>
              </div>
            </MiniDetail>
          ))}
        </LineList>

        <AddButton onClick={()=>set({items:[...items,normalizeLinkItem({id:uid(),emoji:'🔗',iconMode:'emoji',label:'새 링크',target:'url',url:'https://'})]})}/>
      </Step>

    </EditorStack>
  );
}


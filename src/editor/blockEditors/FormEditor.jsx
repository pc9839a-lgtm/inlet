import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Choice, EditorStack, Field, Step, Toggle } from '../controls.jsx';
import { formQuestionOptions } from '../editorOptions.js';
import RichField from '../RichField.jsx';
import { uid } from '../../lib/pageModel.js';
import { notify } from '../../lib/uiFeedback.js';

export default function FormEditor({ s, set, page, generateStandaloneFormHtml }) {
  const qs = s.questions || [];
  const themeButtonColor = page?.theme?.accent || '#111827';
  const [openQ, setOpenQ] = useState(qs[0]?.id || '');
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [dragQ, setDragQ] = useState('');
  const [dragOverQ, setDragOverQ] = useState('');

  const createQuestion = (patch = {}) => ({
    id: uid(),
    label: patch.label || '새 질문',
    type: patch.type || 'short',
    required: patch.required ?? false,
    placeholder: patch.placeholder || '',
    options: patch.options || [],
  });

  const update = (id, patch) => set({ questions: qs.map((q)=>q.id===id?{...q,...patch}:q) });
  const remove = (id) => {
    const next = qs.filter((q)=>q.id!==id);
    set({ questions: next });
    if (openQ === id) setOpenQ(next[0]?.id || '');
  };
  const duplicate = (q) => {
    const idx = qs.findIndex((x)=>x.id===q.id);
    const copy = { ...q, id: uid(), label: `${q.label || '질문'} 복사` };
    const next = [...qs];
    next.splice(idx + 1, 0, copy);
    set({ questions: next });
    setOpenQ(copy.id);
  };
  const moveByDrag = (targetId) => {
    if (!dragQ || dragQ === targetId) return;
    const from = qs.findIndex((q)=>q.id===dragQ);
    const to = qs.findIndex((q)=>q.id===targetId);
    if (from < 0 || to < 0) return;
    const next = [...qs];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ questions: next });
    setDragOverQ(targetId);
  };
  const move = (id, dir) => {
    const idx = qs.findIndex((q)=>q.id===id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= qs.length) return;
    const next = [...qs];
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    set({ questions: next });
  };
  const add = (type = 'short') => {
    const q = createQuestion({
      type,
      label: ({name:'이름',phone:'연락처',email:'이메일',address:'주소',long:'문의내용',select:'선택 질문',multi:'복수 선택 질문'}[type] || '새 질문')
    });
    set({ questions: [...qs, q] });
    setOpenQ(q.id);
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <div className="form-basic-grid">
          <Field label="폼 제목" value={s.title} onChange={(v)=>set({title:v})}/>
          <Field label="버튼 문구" value={s.submit} onChange={(v)=>set({submit:v})}/>
        </div>
        <RichField label="설명" value={s.desc} onChange={(v)=>set({desc:v})}/>
        <Choice label="정렬" value={s.textAlign || 'left'} onChange={(v)=>set({textAlign:v})} options={[["left","≡"],["center","≣"],["right","≢"]]}/>

        <div className="form-basic-subgrid compact-lines">
          <details className="form-basic-detail form-inline-detail">
            <summary><strong>완료 화면</strong><span>제출 후 문구</span></summary>
            <div className="form-one-line-panel">
              <Field label="완료 제목" value={s.successTitle || '상담 신청 완료'} onChange={(v)=>set({successTitle:v})}/>
              <Field label="제출 후 문구" textarea value={s.success} onChange={(v)=>set({success:v})}/>
            </div>
          </details>

          <details className="form-basic-detail form-inline-detail">
            <summary><strong>개인정보</strong><span>동의/약관</span></summary>
            <div className="privacy-compact-panel">
              <div className="privacy-inline-top compact-row">
                <span>필수 동의</span>
                <button type="button" className={s.privacyRequired ?? true ? 'active' : ''} onClick={()=>set({privacyRequired:!(s.privacyRequired ?? true)})}>
                  {(s.privacyRequired ?? true) ? 'ON' : 'OFF'}
                </button>
              </div>
              <Field label="동의 문구" textarea value={s.privacy} onChange={(v)=>set({privacy:v})}/>
              <Field label="자세히 보기" textarea value={s.privacyDetail || ''} onChange={(v)=>set({privacyDetail:v})}/>
            </div>
          </details>
        </div>
      </Step>

      <Step title="입력 항목" icon="2">
        <div className="form-question-tools inlet-question-tools">
          {[
            ['name','이름'],['phone','연락처'],['email','이메일'],['address','주소'],
            ['short','단답'],['long','장문'],['select','선택'],['multi','복수'],
          ].map(([type,label]) => (
            <button type="button" key={type} onClick={()=>add(type)}>+ {label}</button>
          ))}
        </div>

        <div className="form-question-list form-question-sortable">
          {qs.map((q, i) => (
            <div
              key={q.id}
              draggable
              onDragStart={()=>{setDragQ(q.id); setDragOverQ(q.id);}}
              onDragOver={(e)=>e.preventDefault()}
              onDragEnter={()=>moveByDrag(q.id)}
              onDrop={(e)=>{e.preventDefault(); setDragOverQ('');}}
              onDragEnd={()=>{setDragQ(''); setDragOverQ('');}}
              className={`form-question-card ${openQ===q.id?'open':''} ${dragQ===q.id?'dragging':''} ${dragOverQ===q.id?'drag-over':''}`}
            >
              <div className="form-question-head-row">
                <button type="button" className="drag-handle" title="드래그">⋮⋮</button>
                <button type="button" className="form-question-title" onClick={()=>setOpenQ(openQ===q.id?'':q.id)}>
                  <span>{i+1}</span>
                  <strong>{q.label || '질문명 없음'}</strong>
                  <em>{q.required ? '필수' : '선택'}</em>
                  <b>{questionTypeLabel(q.type)}</b>
                </button>
                <button type="button" onClick={()=>duplicate(q)} title="복제">⧉</button>
                <button type="button" className="danger" onClick={()=>remove(q.id)} title="삭제">×</button>
              </div>

              {openQ===q.id && (
                <div className="form-question-body">
                  <Field label="질문명" value={q.label} onChange={(v)=>update(q.id,{label:v})}/>
                  <div className="question-compact-row">
                    <label>
                      <span>유형</span>
                      <select value={q.type} onChange={(e)=>update(q.id,{type:e.target.value,options:['select','multi'].includes(e.target.value) ? (q.options?.length?q.options:['선택 1','선택 2']) : []})}>
                        {formQuestionOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="required-inline">
                      <span>필수</span>
                      <button type="button" className={q.required ? 'active' : ''} onClick={()=>update(q.id,{required:!q.required})}>
                        {q.required ? 'ON' : 'OFF'}
                      </button>
                    </label>
                  </div>
                  <Field label="안내문구" value={q.placeholder || ''} onChange={(v)=>update(q.id,{placeholder:v})}/>
                  {['select','multi'].includes(q.type) && (
                    <OptionEditor options={q.options || []} onChange={(options)=>update(q.id,{options})}/>
                  )}
                  <div className="form-question-actions">
                    <button type="button" onClick={()=>move(q.id,-1)} disabled={i===0}>↑</button>
                    <button type="button" onClick={()=>move(q.id,1)} disabled={i===qs.length-1}>↓</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {!qs.length && <div className="empty">질문을 추가해주세요.</div>}
      </Step>

      <Step title="디자인" icon="3">
        <div className="form-design-panel form-design-panel-clean">
          <Choice label="폼" value={s.style || 'card'} onChange={(v)=>set({style:v})} options={[['card','▣'],['line','≣'],['soft','◧'],['minimal','□']]}/>
          <Choice label="입력창" value={s.inputStyle || 'round'} onChange={(v)=>set({inputStyle:v})} options={[['round','◖'],['box','▢'],['underline','﹍']]}/>

          <div className="button-design-box">
            <div className="button-design-title">
              <strong>버튼 디자인&효과</strong>
            </div>
            <Choice label="모양" value={s.buttonStyle || 'solid'} onChange={(v)=>set({buttonStyle:v})} options={[['solid','⬛'],['round','◉'],['line','▭']]}/>
            <Choice label="효과" value={s.buttonHover || 'fill'} onChange={(v)=>set({buttonHover:v})} options={[['fill','●'],['slide','➜'],['zoom','⊕']]}/>
            <div className="form-hover-color-row compact">
              <label><span>마우스오버</span><input type="color" value={s.buttonHoverColorMode === 'custom' ? (s.buttonHoverColor || themeButtonColor) : themeButtonColor} onChange={(e)=>set({buttonHoverColor:e.target.value, buttonHoverColorMode:'custom'})}/><button type="button" className="global-color-reset" onClick={()=>set({buttonHoverColorMode:'theme'})}>전역</button></label>
              <label><span>버튼색</span><input type="color" value={s.buttonColorMode === 'custom' ? (s.buttonColor || themeButtonColor) : themeButtonColor} onChange={(e)=>set({buttonColor:e.target.value, buttonColorMode:'custom'})}/><button type="button" className="global-color-reset" onClick={()=>set({buttonColorMode:'theme'})}>전역</button></label>
              <label><span>글자색</span><input type="color" value={s.buttonTextColor || '#ffffff'} onChange={(e)=>set({buttonTextColor:e.target.value})}/></label>
            </div>
          </div>

          <div className="form-design-range">
            <span>입력 간격</span>
            <input type="range" min="6" max="24" step="1" value={Number(s.spacingPx ?? 12)} onChange={(e)=>set({spacingPx:Number(e.target.value)})}/>
            <b>{Number(s.spacingPx ?? 12)}px</b>
          </div>
        </div>
      </Step>

      <Step title="고급" icon="4">
        <div className="form-advanced-group">
          <details className="form-advanced-item">
            <summary><strong>중복접수</strong><span>연락처/이메일 기준</span></summary>
            <div>
              <div className="form-design-grid">
                <Choice label="연락처" value={s.duplicatePhone || 'allow'} onChange={(v)=>set({duplicatePhone:v})} options={[['allow','허용'],['warn','경고'],['block','차단']]}/>
                <Choice label="이메일" value={s.duplicateEmail || 'off'} onChange={(v)=>set({duplicateEmail:v})} options={[['off','끔'],['warn','경고'],['block','차단']]}/>
              </div>
              <Choice label="기준 기간" value={s.duplicateWindow || '24h'} onChange={(v)=>set({duplicateWindow:v})} options={[['1d','1일'],['3d','3일'],['7d','7일'],['30d','30일']]}/>
              <div className="form-advanced-note">IP 중복처리는 서버/API 연동 후 정확히 처리할 수 있습니다.</div>
            </div>
          </details>

          <details className="form-advanced-item">
            <summary><strong>전환추적</strong><span>접수 성공 이벤트</span></summary>
            <div>
              <div className="form-advanced-note">접수 성공 시 내부 통계와 dataLayer 이벤트 <b>inlet_form_submit</b>이 기록됩니다. Google Ads, Meta Pixel, GTM 연동은 이후 설정 화면에서 확장합니다.</div>
            </div>
          </details>

          <div className="inlet-export-card compact">
            <strong>HTML 추출</strong>
            <p>다른 페이지에 붙여 쓸 수 있는 상담폼 단독 코드를 생성합니다.</p>
            <button type="button" onClick={()=>setHtmlOpen(true)}>코드 복사/보기</button>
          </div>
        </div>

        {htmlOpen && <FormHtmlModal form={s} generateStandaloneFormHtml={generateStandaloneFormHtml} onClose={()=>setHtmlOpen(false)}/>}
      </Step>
    </EditorStack>
  );
}

function questionTypeLabel(type) {
  return ({
    name: '이름',
    short: '단답형',
    long: '장문형',
    phone: '연락처',
    email: '이메일',
    address: '주소',
    select: '선택형',
    multi: '복수선택',
  }[type] || '단답형');
}

function FormHtmlModal({ form, onClose, generateStandaloneFormHtml }) {
  const code = useMemo(() => generateStandaloneFormHtml(form), [form]);
  const [showCode, setShowCode] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const focusable = dialogRef.current?.querySelector?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus?.();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      notify('HTML 코드를 복사했습니다.', 'success');
    } catch {
      notify('복사에 실패했습니다. 직접 선택해서 복사해주세요.', 'error');
      setShowCode(true);
    }
  };

  return createPortal(
    <div className="inlet-html-modal-backdrop" role="presentation">
      <div ref={dialogRef} className="inlet-html-modal compact" role="dialog" aria-modal="true" aria-labelledby="inlet-html-modal-title">
        <div className="inlet-html-head">
          <div>
            <strong id="inlet-html-modal-title">Inlet Form HTML</strong>
            <span>주소검색까지 포함된 단독 실행 코드입니다.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="inlet-code-notice">
          <b>현재는 단독 실행형 코드</b>
          <p>서버/CDN 없이도 붙여넣으면 바로 작동하도록 스타일과 스크립트를 포함합니다. 그래서 코드가 길어집니다. 추후 Inlet 공통 스크립트를 배포하면 짧은 임베드 코드로 전환할 수 있습니다.</p>
        </div>

        {showCode && <textarea readOnly value={code}/>}

        <div className="inlet-html-actions">
          <button type="button" onClick={()=>setShowCode(!showCode)}>{showCode ? '코드 숨기기' : '코드 보기'}</button>
          <button type="button" onClick={onClose}>닫기</button>
          <button type="button" className="primary" onClick={copy}>코드 복사</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function OptionEditor({ options = [], onChange }) {
  const list = options.length ? options : ['선택 1', '선택 2'];
  const update = (idx, value) => onChange(list.map((item, i)=>i===idx?value:item).filter((item)=>String(item).trim()));
  const remove = (idx) => onChange(list.filter((_, i)=>i!==idx));
  return (
    <div className="option-editor">
      <span>선택지</span>
      {list.map((option, idx)=>(
        <div key={idx}>
          <input value={option} onChange={(e)=>update(idx,e.target.value)} />
          <button type="button" onClick={()=>remove(idx)}>×</button>
        </div>
      ))}
      <button type="button" onClick={()=>onChange([...list, `선택 ${list.length + 1}`])}>선택지 추가</button>
    </div>
  );
}


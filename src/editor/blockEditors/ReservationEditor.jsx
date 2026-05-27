import { useState } from 'react';
import { Choice, EditorStack, Field, Step, Toggle } from '../controls.jsx';

const customFieldTypes = [
  ['short', '짧은 답변'],
  ['long', '긴 답변'],
  ['select', '선택'],
];

const dayOptions = [
  ['mon', '월'],
  ['tue', '화'],
  ['wed', '수'],
  ['thu', '목'],
  ['fri', '금'],
  ['sat', '토'],
  ['sun', '일'],
];

const weekdayDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
const everydayDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const weekdayPresets = [
  ['weekday', '평일'],
  ['everyday', '연중무휴'],
  ['custom', '상세요일'],
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function makeCustomField() {
  return {
    id: uid(),
    label: '추가 항목',
    type: 'short',
    required: false,
    options: ['선택 1', '선택 2'],
  };
}

function sameDays(a = [], b = []) {
  return a.length === b.length && a.every((day) => b.includes(day));
}

function splitOptions(value) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ReservationEditor({ s, set, page }) {
  const themeButtonColor = page?.theme?.accent || '#111827';
  const [dragId, setDragId] = useState('');
  const [dragOverId, setDragOverId] = useState('');
  const [optionDrafts, setOptionDrafts] = useState({});
  const customFields = Array.isArray(s.customFields) ? s.customFields : [];
  const required = { name: true, phone: true, ...(s.required || {}) };
  const selectedDays = Array.isArray(s.weekdays) ? s.weekdays : [];
  const weekdayMode = s.weekdayMode || (sameDays(selectedDays, weekdayDays) ? 'weekday' : sameDays(selectedDays, everydayDays) ? 'everyday' : 'custom');

  const toggleDay = (day) => {
    set({
      weekdayMode: 'custom',
      weekdays: selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : [...selectedDays, day],
    });
  };

  const setWeekdayPreset = (mode) => {
    if (mode === 'weekday') set({ weekdayMode: mode, weekdays: weekdayDays });
    if (mode === 'everyday') set({ weekdayMode: mode, weekdays: everydayDays });
    if (mode === 'custom') set({ weekdayMode: mode, weekdays: selectedDays.length ? selectedDays : weekdayDays });
  };

  const setRequired = (key, value) => {
    set({ required: { ...required, [key]: value } });
  };

  const updateCustom = (id, patch) => {
    set({ customFields: customFields.map((field) => field.id === id ? { ...field, ...patch } : field) });
  };

  const updateOptions = (id, value) => {
    setOptionDrafts((drafts) => ({ ...drafts, [id]: value }));
    updateCustom(id, { options: splitOptions(value) });
  };

  const removeCustom = (id) => {
    set({ customFields: customFields.filter((field) => field.id !== id) });
  };

  const addCustom = () => {
    set({ customFields: [...customFields, makeCustomField()] });
  };

  const moveCustom = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const from = customFields.findIndex((field) => field.id === dragId);
    const to = customFields.findIndex((field) => field.id === targetId);
    if (from < 0 || to < 0) return;

    const next = [...customFields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ customFields: next });
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <div className="reservation-basic-grid">
          <Field label="예약 제목" value={s.title} onChange={(value) => set({ title: value })} />
          <Field label="완료 문구" value={s.success || '방문예약 신청이 접수되었습니다.'} onChange={(value) => set({ success: value })} />
        </div>
        <Field label="설명" value={s.desc} onChange={(value) => set({ desc: value })} textarea />
      </Step>

      <Step title="예약 시간" icon="2">
        <div className="reservation-weekday-panel">
          <Choice label="상담 가능 요일" value={weekdayMode} onChange={setWeekdayPreset} options={weekdayPresets} />
          <div className="reservation-day-detail">
            <span>상세요일 선택</span>
            <div>
              {dayOptions.map(([key, label]) => (
                <button key={key} type="button" className={selectedDays.includes(key) ? 'active' : ''} onClick={() => toggleDay(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="reservation-time-grid">
          <Field label="시작" type="time" value={s.start} onChange={(value) => set({ start: value })} />
          <Field label="종료" type="time" value={s.end} onChange={(value) => set({ end: value })} />
        </div>
        <Choice label="간격" value={String(s.interval || 30)} onChange={(value) => set({ interval: Number(value) })} options={[['30', '30분'], ['60', '1시간']]} />
      </Step>

      <Step title="입력 항목" icon="3">
        <div className="reservation-fixed-fields">
          <div className="reservation-fixed-field">
            <strong>1. 이름</strong>
            <Toggle label="필수" checked={required.name !== false} onChange={(value) => setRequired('name', value)} />
          </div>
          <div className="reservation-fixed-field">
            <strong>2. 연락처</strong>
            <Toggle label="필수" checked={required.phone !== false} onChange={(value) => setRequired('phone', value)} />
          </div>
          <div className="reservation-fixed-field">
            <strong>3. 방문날짜</strong>
            <span>필수</span>
          </div>
          <div className="reservation-fixed-field">
            <strong>4. 방문시간</strong>
            <span>필수</span>
          </div>
        </div>

        <div className="reservation-custom-head">
          <strong>추가 입력 옵션</strong>
          <button type="button" onClick={addCustom}>+ 추가</button>
        </div>

        <div className="form-question-list reservation-custom-list">
          {customFields.length === 0 && <div className="empty">추가 입력 옵션이 없습니다.</div>}
          {customFields.map((field, index) => (
            <div
              key={field.id}
              className={`form-question-card reservation-custom-card ${dragId === field.id ? 'dragging' : ''} ${dragOverId === field.id ? 'drag-over' : ''}`}
              draggable
              onDragStart={(event) => {
                setDragId(field.id);
                event.dataTransfer.setData('text/plain', field.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverId(field.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveCustom(field.id);
                setDragId('');
                setDragOverId('');
              }}
              onDragEnd={() => {
                setDragId('');
                setDragOverId('');
              }}
            >
              <div className="form-question-card-head">
                <button type="button" className="drag-handle" title="드래그해서 순서 변경">⋮⋮</button>
                <strong>{index + 1}. {field.label || '추가 항목'}</strong>
                <button type="button" className="question-remove" onClick={() => removeCustom(field.id)}>삭제</button>
              </div>

              <div className="mini-body">
                <Field label="항목명" value={field.label} onChange={(value) => updateCustom(field.id, { label: value })} />
                <Choice
                  label="입력 방식"
                  value={field.type || 'short'}
                  onChange={(value) => updateCustom(field.id, { type: value, options: value === 'select' ? (field.options?.length ? field.options : ['선택 1', '선택 2']) : field.options })}
                  options={customFieldTypes}
                />
                <Toggle label="필수" checked={!!field.required} onChange={(value) => updateCustom(field.id, { required: value })} />
                {field.type === 'select' && (
                  <label className="field field-content">
                    <span>선택지</span>
                    <textarea
                      placeholder="예: 선택 1, 선택 2, 선택 3"
                      value={optionDrafts[field.id] ?? (field.options || []).join(', ')}
                      onChange={(event) => updateOptions(field.id, event.target.value)}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </Step>

      <Step title="고급" icon="4">
        <div className="reservation-duplicate-grid">
          <Choice label="연락처 중복" value={s.duplicatePhone || 'block'} onChange={(value) => set({ duplicatePhone: value })} options={[['allow', '허용'], ['warn', '경고'], ['block', '차단']]} />
          <Choice label="기준 기간" value={s.duplicateWindow || '1d'} onChange={(value) => set({ duplicateWindow: value })} options={[['1d', '1일'], ['3d', '3일'], ['7d', '7일'], ['30d', '30일']]} />
        </div>
      </Step>

      <Step title="디자인" icon="5">
        <div className="form-design-panel form-design-panel-clean reservation-design-panel">
          <Choice label="폼" value={s.style || 'card'} onChange={(value) => set({ style: value })} options={[['card', '카드'], ['line', '라인'], ['soft', '소프트'], ['minimal', '미니멀']]} />
          <Choice label="입력창" value={s.inputStyle || 'round'} onChange={(value) => set({ inputStyle: value })} options={[['round', '둥근'], ['box', '박스'], ['underline', '밑줄']]} />

          <div className="button-design-box">
            <div className="button-design-title">
              <strong>버튼 디자인과 효과</strong>
            </div>
            <Choice label="모양" value={s.buttonStyle || 'solid'} onChange={(value) => set({ buttonStyle: value })} options={[['solid', '채움'], ['round', '둥근'], ['line', '라인']]} />
            <Choice label="효과" value={s.buttonHover || 'fill'} onChange={(value) => set({ buttonHover: value })} options={[['fill', '채움'], ['slide', '슬라이드'], ['zoom', '확대']]} />
            <div className="form-hover-color-row compact">
              <label><span>마우스오버</span><input type="color" value={s.buttonHoverColorMode === 'custom' ? (s.buttonHoverColor || themeButtonColor) : themeButtonColor} onChange={(event) => set({ buttonHoverColor: event.target.value, buttonHoverColorMode: 'custom' })} /><button type="button" className="global-color-reset" onClick={() => set({ buttonHoverColorMode: 'theme' })}>전역</button></label>
              <label><span>버튼색</span><input type="color" value={s.buttonColorMode === 'custom' ? (s.buttonColor || themeButtonColor) : themeButtonColor} onChange={(event) => set({ buttonColor: event.target.value, buttonColorMode: 'custom' })} /><button type="button" className="global-color-reset" onClick={() => set({ buttonColorMode: 'theme' })}>전역</button></label>
              <label><span>글자색</span><input type="color" value={s.buttonTextColor || '#ffffff'} onChange={(event) => set({ buttonTextColor: event.target.value })} /></label>
            </div>
          </div>

          <div className="form-design-range">
            <span>입력 간격</span>
            <input type="range" min="6" max="24" step="1" value={Number(s.spacingPx ?? 12)} onChange={(event) => set({ spacingPx: Number(event.target.value) })} />
            <b>{Number(s.spacingPx ?? 12)}px</b>
          </div>
        </div>
      </Step>
    </EditorStack>
  );
}

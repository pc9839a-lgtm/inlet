import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { BRAND_NAME } from '../../config/brand.js';
import { checkDuplicateLead as checkDuplicateLeadPolicy, rememberDuplicateLead as rememberDuplicateLeadPolicy } from '../../lib/leadDuplicatePolicy.js';
import { currentTrafficAttribution } from '../../lib/trafficAttribution.js';
import { pickSafe, rich } from './previewUtils.jsx';

function plainRichText(value) {
  if (value == null) return '';
  if (typeof document === 'undefined') return String(value).replace(/<[^>]+>/g, '');
  const node = document.createElement('div');
  node.innerHTML = String(value);
  return node.textContent || node.innerText || '';
}

function themeButtonColor(s = {}) {
  return s.buttonColorMode === 'custom' ? (s.buttonColor || 'var(--accent)') : 'var(--accent)';
}

function themeButtonHoverColor(s = {}) {
  return s.buttonHoverColorMode === 'custom' ? (s.buttonHoverColor || themeButtonColor(s)) : themeButtonColor(s);
}

function lines(text) {
  return String(text || '').split('\n').map((line, i, arr) => (
    <React.Fragment key={i}>
      {line}
      {i < arr.length - 1 && <br />}
    </React.Fragment>
  ));
}

function formatAnswerValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return value.full || [value.postcode, value.address, value.detail].filter(Boolean).join(' ');
  return String(value ?? '');
}

function digitsOnly(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function formClientId() {
  const key = 'pagero_client_id';
  const fallback = `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    const cookieCurrent = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${key}=`))
      ?.slice(key.length + 1);
    const current = cookieCurrent ? decodeURIComponent(cookieCurrent) : window.localStorage.getItem(key);
    const next = current || fallback;
    window.localStorage.setItem(key, next);
    document.cookie = `${key}=${encodeURIComponent(next)}; Max-Age=31536000; Path=/; SameSite=Lax`;
    return next;
  } catch {
    return fallback;
  }
}

function sanitizeQuestionValue(q = {}, value = '') {
  if (q.type === 'phone') return digitsOnly(value);
  return value;
}

function isEmptyAnswer(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return !formatAnswerValue(value).trim();
  return !String(value ?? '').trim();
}

function loadDaumPostcode() {
  return new Promise((resolve) => {
    if (window.daum?.Postcode) return resolve(true);
    const existing = document.querySelector('script[data-daum-postcode="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.dataset.daumPostcode = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function fireInletConversion(payload) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'inlet_form_submit', form_id: payload.formId, form_title: payload.title, lead_type: '상담신청' });
  window.dispatchEvent(new CustomEvent('inlet:form_submit', { detail: payload }));
}

function PreviewInlineNotice({ tone = 'error', message, actionLabel, onAction }) {
  if (!message) return null;
  return (
    <div className={`preview-inline-notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      {actionLabel && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function todayDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function weekdayKeyFromDate(value) {
  const idx = new Date(`${value}T00:00:00`).getDay();
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][idx] || 'mon';
}

function weekdayLabelText(days = []) {
  const map = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  return (days || []).map((d) => map[d]).filter(Boolean).join(' · ') || '월 · 화 · 수 · 목 · 금';
}

function slots(start = '10:00', end = '18:00', interval = 30) {
  const [sh, sm] = String(start || '10:00').split(':').map(Number);
  const [eh, em] = String(end || '18:00').split(':').map(Number);
  let cur = (sh || 10) * 60 + (sm || 0);
  let last = (eh || 18) * 60 + (em || 0);
  const arr = [];
  if (last < cur) last = cur;
  while (cur <= last) {
    arr.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
    cur += Number(interval || 30);
  }
  return arr;
}

export function RenderForm({ block, addLead, track }) {
  const s = block.s || {};
  const [done, setDone] = useState(false);
  const [vals, setVals] = useState({});
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [notice, setNotice] = useState(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);
  const allowDuplicateSubmit = useRef(false);
  const qs = s.questions || [];
  const showPrivacy = !!String(s.privacy || '').trim() || !!String(s.privacyDetail || '').trim() || s.privacyRequired === true;
  const get = (q) => vals[q.id] ?? '';

  useEffect(() => {
    track?.({ type: 'form_view', label: s.title || '상담 폼' });
  }, []);

  const markStart = () => {
    if (started) return;
    setStarted(true);
    track?.({ type: 'form_start', label: s.title || '상담 폼' });
  };

  const submitLead = async ({ allowDuplicate = false } = {}) => {
    if (submitting) return;
    track?.({ type: 'form_submit_attempt', label: s.title || '상담 폼' });
    setNotice(null);
    if (!allowDuplicate) setDuplicatePrompt(null);

    const answers = qs.map((q) => ({ id: q.id, label: q.label, type: q.type, required: !!q.required, value: sanitizeQuestionValue(q, vals[q.id] ?? '') }));
    const missing = answers.find((a) => a.required && isEmptyAnswer(a.value));
    if (missing) {
      track?.({ type: 'form_required_missing', label: missing.label });
      setNotice({ tone: 'error', message: `${missing.label} 항목을 입력해주세요.` });
      return;
    }

    const byLabel = Object.fromEntries(answers.map((a) => [a.label, formatAnswerValue(a.value)]));
    const nameAnswer = answers.find((a) => a.type === 'name' || /이름|성함|name/i.test(a.label));
    const phoneAnswer = answers.find((a) => a.type === 'phone' || /연락처|전화|휴대폰|phone/i.test(a.label));
    const emailAnswer = answers.find((a) => a.type === 'email' || /이메일|메일|email/i.test(a.label));
    const addressAnswer = answers.find((a) => a.type === 'address' || /주소|address/i.test(a.label));
    const messageAnswer = answers.find((a) => a.type === 'long' || /문의|내용|메모|message/i.test(a.label));

    const phone = digitsOnly(phoneAnswer?.value || '');
    const email = String(formatAnswerValue(emailAnswer?.value || '')).trim().toLowerCase();

    const duplicate = checkDuplicateLeadPolicy(block.id, { phone, email }, s);
    if (duplicate.blocked) {
      track?.({ type: 'form_duplicate_blocked', label: duplicate.reason });
      setNotice({ tone: 'error', message: duplicate.message });
      return;
    }
    if (duplicate.warned && !allowDuplicate) {
      track?.({ type: 'form_duplicate_warned', label: duplicate.reason });
      setDuplicatePrompt({ message: `${duplicate.message} 그래도 다시 접수하시겠습니까?` });
      return;
    }

    const traffic = currentTrafficAttribution();
    const leadValues = {
      ...byLabel,
      ...(traffic.sourceUrl ? { sourceUrl: traffic.sourceUrl } : {}),
      ...(traffic.referrer ? { referrer: traffic.referrer } : {}),
      ...(traffic.utmSource ? { utmSource: traffic.utmSource } : {}),
      ...(traffic.utmMedium ? { utmMedium: traffic.utmMedium } : {}),
      ...(traffic.utmCampaign ? { utmCampaign: traffic.utmCampaign } : {}),
      ...(traffic.sourceLabel ? { sourceLabel: traffic.sourceLabel } : {}),
    };

    const lead = {
      type: '상담신청',
      formId: block.id,
      duplicateWindow: s.duplicateWindow || '24h',
      clientId: formClientId(),
      name: String(formatAnswerValue(nameAnswer?.value || '')),
      phone,
      email,
      address: String(formatAnswerValue(addressAnswer?.value || '')),
      message: String(formatAnswerValue(messageAnswer?.value || '')),
      values: leadValues,
      answers,
      sourceBlockTitle: s.title || '상담 폼',
      brand: BRAND_NAME,
      channel: traffic.channel,
      utmSource: traffic.utmSource,
      utmMedium: traffic.utmMedium,
      utmCampaign: traffic.utmCampaign,
      sourceUrl: traffic.sourceUrl,
      referrer: traffic.referrer,
      sourceLabel: traffic.sourceLabel,
      source: {
        channel: traffic.channel,
        utmSource: traffic.utmSource,
        utmMedium: traffic.utmMedium,
        utmCampaign: traffic.utmCampaign,
        sourceUrl: traffic.sourceUrl,
        referrer: traffic.referrer,
        sourceLabel: traffic.sourceLabel,
      },
    };

    setSubmitting(true);
    try {
      await Promise.resolve(addLead(lead));
    } catch (error) {
      const status = Number(error?.status || 0);
      setNotice({
        tone: 'error',
        message: status === 409
          ? '이미 접수된 연락처입니다. 입력한 연락처를 확인해주세요.'
          : status === 429
            ? '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.'
            : '접수 저장에 실패했습니다. 잠시 후 다시 시도해주세요.',
      });
      setSubmitting(false);
      return;
    }
    rememberDuplicateLeadPolicy(block.id, { phone, email }, s);
    track?.({ type: 'form_submit_success', label: s.title || '상담 폼' });
    fireInletConversion({ formId: block.id, title: s.title || '상담 폼', lead });
    setDone(true);
    setVals({});
    setStarted(false);
    setNotice(null);
    setDuplicatePrompt(null);
    setSubmitting(false);
  };

  const submit = (e) => {
    e.preventDefault();
    const allowDuplicate = allowDuplicateSubmit.current;
    allowDuplicateSubmit.current = false;
    submitLead({ allowDuplicate });
  };

  const requestDuplicateSubmit = () => {
    allowDuplicateSubmit.current = true;
    if (formRef.current?.requestSubmit) {
      formRef.current.requestSubmit();
    } else {
      submitLead({ allowDuplicate: true });
    }
  };

  const formStyle = pickSafe(s.style, ['card', 'line', 'soft', 'minimal'], 'card');
  const inputStyle = pickSafe(s.inputStyle, ['round', 'box', 'underline'], 'round');
  const buttonStyle = pickSafe(s.buttonStyle, ['solid', 'round', 'line'], 'solid');
  const buttonHover = pickSafe(s.buttonHover || 'fill', ['fill', 'slide', 'zoom'], 'fill');
  const textAlign = pickSafe(s.textAlign || 'left', ['left', 'center', 'right'], 'left');
  const spacing = pickSafe(s.spacing, ['compact', 'normal', 'wide'], 'normal');
  const radiusStyle = pickSafe(s.radiusStyle, ['square', 'round', 'pill'], 'round');
  const spacingGap = { compact: 8, normal: 12, wide: 18 }[spacing] || 12;
  const styleVars = {
    '--form-button': themeButtonColor(s),
    '--form-button-text': s.buttonTextColor || '#ffffff',
    '--form-gap': `${spacingGap}px`,
    '--form-button-hover': themeButtonHoverColor(s),
  };
  const formTitle = plainRichText(s.title ?? '상담 신청');
  const formDesc = s.desc || '';

  return (
    <section id={`block-${block.id}`} className={`landing-section form form-${formStyle} form-input-${inputStyle} form-button-${buttonStyle} form-button-hover-${buttonHover} form-space-${spacing} form-radius-${radiusStyle} form-align-${textAlign}`} style={styleVars}>
      {formTitle && <h2 className={`form-title-align-${textAlign}`}>{formTitle}</h2>}
      {formDesc && <p className={`form-desc-align-${textAlign}`}>{rich(formDesc)}</p>}
      {done ? (
        <div className="success">
          <CheckCircle2 size={24} />
          {(s.successTitle ?? '상담 신청 완료') && <h3>{s.successTitle ?? '상담 신청 완료'}</h3>}
          {s.success && <p>{s.success}</p>}
          <button type="button" onClick={() => setDone(false)}>다시 작성</button>
        </div>
      ) : (
        <form ref={formRef} onSubmit={submit} onInput={markStart} onInvalidCapture={() => { allowDuplicateSubmit.current = false; }}>
          {qs.map((q) => (
            <Question
              key={q.id}
              q={q}
              value={get(q)}
              setValue={(v) => {
                setVals((p) => ({ ...p, [q.id]: v }));
                setNotice(null);
                setDuplicatePrompt(null);
              }}
            />
          ))}
          {showPrivacy && (
            <label className="agree">
              <input type="checkbox" required={s.privacyRequired ?? true} />
              <span>{s.privacy || '동의합니다.'}</span>
              {(s.privacyRequired ?? true) && <b>*</b>}
            </label>
          )}
          {showPrivacy && s.privacyDetail && (
            <button className="privacy-more" type="button" onClick={() => { setPrivacyOpen(!privacyOpen); track?.({ type: 'privacy_open', label: s.title || '상담 폼' }); }}>
              {privacyOpen ? '개인정보 내용 닫기' : '개인정보 내용 보기'}
            </button>
          )}
          {showPrivacy && privacyOpen && <div className="privacy-detail">{lines(s.privacyDetail)}</div>}
          <PreviewInlineNotice tone={notice?.tone} message={notice?.message} />
          <PreviewInlineNotice
            tone="warning"
            message={duplicatePrompt?.message}
            actionLabel="다시 접수"
            onAction={requestDuplicateSubmit}
          />
          <button type="submit" disabled={submitting}>{submitting ? '접수 중' : (s.submit || '신청하기')}</button>
        </form>
      )}
    </section>
  );
}

function FormFieldShell({ q, children }) {
  return (
    <div className={`form-field form-field-${q.type || 'short'}`}>
      <label className="form-field-label">
        <span>{q.label || '질문'}</span>
        {q.required && <b>*</b>}
      </label>
      {children}
    </div>
  );
}

function Question({ q, value, setValue }) {
  const defaultPlaceholders = {
    name: '이름을 입력해주세요',
    phone: '010-0000-0000',
    email: 'example@email.com',
    address: '주소를 입력해주세요',
    long: '문의 내용을 입력해주세요',
    select: '선택해주세요',
    multi: '선택해주세요',
    short: '내용을 입력해주세요',
  };
  const placeholder = q.placeholder || defaultPlaceholders[q.type] || '내용을 입력해주세요';

  if (q.type === 'long') {
    return (
      <FormFieldShell q={q}>
        <textarea required={q.required} placeholder={placeholder} value={value || ''} onChange={(e) => setValue(e.target.value)} />
      </FormFieldShell>
    );
  }

  if (q.type === 'email') {
    return (
      <FormFieldShell q={q}>
        <input type="email" inputMode="email" autoComplete="email" required={q.required} placeholder={placeholder || 'example@email.com'} value={value || ''} onChange={(e) => setValue(e.target.value)} />
      </FormFieldShell>
    );
  }

  if (q.type === 'phone') {
    return (
      <FormFieldShell q={q}>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="tel"
          required={q.required}
          placeholder={placeholder || '01000000000'}
          value={digitsOnly(value)}
          onChange={(e) => setValue(digitsOnly(e.target.value))}
        />
      </FormFieldShell>
    );
  }

  if (q.type === 'name') {
    return (
      <FormFieldShell q={q}>
        <input type="text" autoComplete="name" required={q.required} placeholder={placeholder || '이름을 입력해주세요'} value={value || ''} onChange={(e) => setValue(e.target.value)} />
      </FormFieldShell>
    );
  }

  if (q.type === 'address') {
    return (
      <FormFieldShell q={q}>
        <AddressQuestion q={q} value={value} setValue={setValue} />
      </FormFieldShell>
    );
  }

  if (q.type === 'select') {
    return (
      <FormFieldShell q={q}>
        <select required={q.required} value={value || ''} onChange={(e) => setValue(e.target.value)}>
          <option value="">{q.placeholder || '선택해주세요'}</option>
          {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </FormFieldShell>
    );
  }

  if (q.type === 'multi') {
    const arr = Array.isArray(value) ? value : [];
    return (
      <FormFieldShell q={q}>
        <div className="multi">
          {(q.options || []).map((o) => (
            <label key={o}>
              <input
                type="checkbox"
                required={q.required && arr.length === 0}
                checked={arr.includes(o)}
                onChange={(e) => setValue(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
              /> {o}
            </label>
          ))}
        </div>
      </FormFieldShell>
    );
  }

  return (
    <FormFieldShell q={q}>
      <input required={q.required} placeholder={placeholder} value={value || ''} onChange={(e) => setValue(e.target.value)} />
    </FormFieldShell>
  );
}

function AddressQuestion({ q, value, setValue }) {
  const v = value && typeof value === 'object' ? value : { postcode: '', address: '', detail: '' };
  const [error, setError] = useState('');

  const open = async () => {
    setError('');
    const ok = await loadDaumPostcode();
    if (!ok || !window.daum?.Postcode) {
      setError('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        const base = data.roadAddress || data.jibunAddress || '';
        const detail = v.detail || '';
        setValue({
          postcode: data.zonecode || '',
          address: base,
          roadAddress: data.roadAddress || '',
          jibunAddress: data.jibunAddress || '',
          detail,
          full: `${base} ${detail}`.trim(),
        });
        setError('');
      },
    }).open();
  };

  const setDetail = (detail) => {
    setValue({
      ...v,
      detail,
      full: `${v.address || ''} ${detail || ''}`.trim(),
    });
  };

  return (
    <div className="address-question">
      <button type="button" onClick={open}>주소 검색</button>
      <input required={q.required} readOnly placeholder="주소 검색 버튼을 눌러주세요" value={v.address || ''} />
      <input placeholder="상세주소를 입력해주세요" value={v.detail || ''} onChange={(e) => setDetail(e.target.value)} />
      {v.postcode && <small>우편번호 {v.postcode}</small>}
      {error && <small className="address-question-error" role="alert">{error}</small>}
    </div>
  );
}

function ReservationCustomField({ field, value, onChange }) {
  const type = field.type || 'short';
  const q = {
    label: field.label || '추가 항목',
    required: !!field.required,
    type,
  };

  if (type === 'long') {
    return (
      <FormFieldShell q={q}>
        <textarea required={q.required} placeholder={`${q.label}을 입력해주세요`} value={value} onChange={(e) => onChange(e.target.value)} />
      </FormFieldShell>
    );
  }

  if (type === 'select') {
    return (
      <FormFieldShell q={q}>
        <select required={q.required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택해주세요</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </FormFieldShell>
    );
  }

  if (type === 'phone') {
    return (
      <FormFieldShell q={q}>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="tel"
          required={q.required}
          placeholder={`${q.label}을 입력해주세요`}
          value={digitsOnly(value)}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
        />
      </FormFieldShell>
    );
  }

  return (
    <FormFieldShell q={q}>
      <input required={q.required} placeholder={`${q.label}을 입력해주세요`} value={value} onChange={(e) => onChange(e.target.value)} />
    </FormFieldShell>
  );
}

export function RenderReservation({ block, addLead, track }) {
  const s = block.s || {};
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [duplicatePrompt, setDuplicatePrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);
  const allowDuplicateSubmit = useRef(false);
  const reservationStarted = useRef(false);
  const [f, setF] = useState({ name: '', phone: '', date: '', time: '', custom: {} });

  const days = Array.isArray(s.weekdays) && s.weekdays.length ? s.weekdays : ['mon', 'tue', 'wed', 'thu', 'fri'];
  const available = f.date ? days.includes(weekdayKeyFromDate(f.date)) : true;
  const timeOptions = slots(s.start, s.end, s.interval);
  const customFields = Array.isArray(s.customFields) ? s.customFields : [];
  const required = { name: true, phone: true, ...(s.required || {}) };

  const setCustomValue = (id, value) => {
    setF((prev) => ({ ...prev, custom: { ...(prev.custom || {}), [id]: value } }));
  };

  const submitReservation = async ({ allowDuplicate = false } = {}) => {
    if (submitting) return;
    setError('');
    if (!allowDuplicate) setDuplicatePrompt('');
    track?.({ type: 'reservation_submit_attempt', label: s.title || '방문 예약' });

    if (!available) {
      setError(`선택한 날짜는 예약 가능한 요일이 아닙니다. 가능 요일: ${weekdayLabelText(days)}`);
      return;
    }

    const phone = digitsOnly(f.phone);
    if (required.name !== false && !String(f.name || '').trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (required.phone !== false && !phone) {
      setError('연락처를 입력해주세요.');
      return;
    }
    if (!String(f.date || '').trim()) {
      setError('방문 날짜를 선택해주세요.');
      return;
    }
    if (!String(f.time || '').trim()) {
      setError('방문 시간을 선택해주세요.');
      return;
    }

    const missingCustom = customFields.find((field) => field.required && !String(f.custom?.[field.id] || '').trim());
    if (missingCustom) {
      setError(`${missingCustom.label || '추가 항목'} 항목을 입력해주세요.`);
      return;
    }

    const duplicateSettings = {
      duplicatePhone: s.duplicatePhone || 'block',
      duplicateEmail: 'off',
      duplicateWindow: s.duplicateWindow || '1d',
    };
    const duplicate = checkDuplicateLeadPolicy(block.id, { phone, email: '' }, duplicateSettings);
    if (duplicate.blocked) {
      setError('이미 접수된 연락처입니다.');
      return;
    }
    if (duplicate.warned && !allowDuplicate) {
      setDuplicatePrompt('이미 접수된 연락처입니다. 그래도 다시 접수하시겠습니까?');
      return;
    }

    const customAnswers = customFields.map((field) => ({
      id: field.id,
      label: field.label || '추가 항목',
      type: field.type || 'short',
      required: !!field.required,
      value: sanitizeQuestionValue(field, f.custom?.[field.id] || ''),
    }));
    const customValues = Object.fromEntries(customAnswers.map((answer) => [answer.label, answer.value]));
    const traffic = currentTrafficAttribution();

    const lead = {
      type: '방문예약',
      formId: block.id,
      duplicateWindow: duplicateSettings.duplicateWindow,
      clientId: formClientId(),
      name: f.name,
      phone,
      message: `${f.date} ${f.time}`,
      values: {
        예약일: f.date,
        예약시간: f.time,
        이름: f.name,
        연락처: phone,
        ...customValues,
        ...(traffic.sourceUrl ? { sourceUrl: traffic.sourceUrl } : {}),
        ...(traffic.referrer ? { referrer: traffic.referrer } : {}),
        ...(traffic.utmSource ? { utmSource: traffic.utmSource } : {}),
        ...(traffic.utmMedium ? { utmMedium: traffic.utmMedium } : {}),
        ...(traffic.utmCampaign ? { utmCampaign: traffic.utmCampaign } : {}),
        ...(traffic.sourceLabel ? { sourceLabel: traffic.sourceLabel } : {}),
      },
      answers: [
        { id: 'reserve-date', label: '예약일', type: 'date', required: true, value: f.date },
        { id: 'reserve-time', label: '예약시간', type: 'time', required: true, value: f.time },
        { id: 'reserve-name', label: '이름', type: 'name', required: required.name !== false, value: f.name },
        { id: 'reserve-phone', label: '연락처', type: 'phone', required: required.phone !== false, value: phone },
        ...customAnswers,
      ],
      sourceBlockTitle: s.title || '방문예약',
      brand: BRAND_NAME,
      channel: traffic.channel,
      utmSource: traffic.utmSource,
      utmMedium: traffic.utmMedium,
      utmCampaign: traffic.utmCampaign,
      sourceUrl: traffic.sourceUrl,
      referrer: traffic.referrer,
      sourceLabel: traffic.sourceLabel,
      source: {
        channel: traffic.channel,
        utmSource: traffic.utmSource,
        utmMedium: traffic.utmMedium,
        utmCampaign: traffic.utmCampaign,
        sourceUrl: traffic.sourceUrl,
        referrer: traffic.referrer,
        sourceLabel: traffic.sourceLabel,
      },
    };
    setSubmitting(true);
    try {
      await Promise.resolve(addLead(lead));
    } catch (submitError) {
      const status = Number(submitError?.status || 0);
      setError(status === 409
        ? '이미 접수된 연락처입니다. 입력한 연락처를 확인해주세요.'
        : status === 429
          ? '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.'
          : '예약 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setSubmitting(false);
      return;
    }
    track?.({ type: 'reservation_submit_success', label: s.title || '방문 예약' });
    rememberDuplicateLeadPolicy(block.id, { phone, email: '' }, duplicateSettings);
    setDone(true);
    setDuplicatePrompt('');
    setF({ name: '', phone: '', date: '', time: '', custom: {} });
    setSubmitting(false);
  };

  const submit = (e) => {
    e.preventDefault();
    const allowDuplicate = allowDuplicateSubmit.current;
    allowDuplicateSubmit.current = false;
    submitReservation({ allowDuplicate });
  };

  const requestDuplicateSubmit = () => {
    allowDuplicateSubmit.current = true;
    if (formRef.current?.requestSubmit) {
      formRef.current.requestSubmit();
    } else {
      submitReservation({ allowDuplicate: true });
    }
  };

  const markReservationStart = () => {
    if (reservationStarted.current) return;
    reservationStarted.current = true;
    track?.({ type: 'form_start', label: s.title || '방문 예약' });
  };

  const formStyle = pickSafe(s.style, ['card', 'line', 'soft', 'minimal'], 'card');
  const inputStyle = pickSafe(s.inputStyle, ['round', 'box', 'underline'], 'round');
  const buttonStyle = pickSafe(s.buttonStyle, ['solid', 'round', 'line'], 'solid');
  const buttonHover = pickSafe(s.buttonHover || 'fill', ['fill', 'slide', 'zoom'], 'fill');
  const textAlign = pickSafe(s.textAlign || 'left', ['left', 'center', 'right'], 'left');
  const titleSize = pickSafe(s.titleSize || 'medium', ['small', 'medium', 'large'], 'medium');
  const bodySize = pickSafe(s.bodySize || 'medium', ['small', 'medium', 'large'], 'medium');
  const spacing = pickSafe(s.spacing, ['compact', 'normal', 'wide'], 'normal');
  const radiusStyle = pickSafe(s.radiusStyle, ['square', 'round', 'pill'], 'round');
  const spacingGap = { compact: 8, normal: 12, wide: 18 }[spacing] || 12;
  const styleVars = {
    '--form-button': themeButtonColor(s),
    '--form-button-text': s.buttonTextColor || '#ffffff',
    '--form-gap': `${spacingGap}px`,
    '--form-button-hover': themeButtonHoverColor(s),
    '--block-margin': `${Math.max(0, Math.min(48, Number(s.marginY ?? 12)))}px`,
  };

  return (
    <section id={`block-${block.id}`} className={`landing-section form reservation reservation-v2 form-${formStyle} form-input-${inputStyle} form-button-${buttonStyle} form-button-hover-${buttonHover} form-space-${spacing} form-radius-${radiusStyle} form-align-${textAlign} align-${textAlign} title-${titleSize} body-${bodySize}`} style={styleVars}>
      <h2>{rich(s.title)}</h2>
      {s.desc && <p>{rich(s.desc)}</p>}

      <div className="reservation-guide">
        <span>가능 요일</span>
        <b>{weekdayLabelText(days)}</b>
        <span>예약 간격</span>
        <b>{Number(s.interval || 30)}분</b>
      </div>

      {done ? (
        <div className="success">
          <CheckCircle2 size={24} />
          {(s.success ?? '방문예약 신청이 접수되었습니다.') && <h3>{s.success ?? '방문예약 신청이 접수되었습니다.'}</h3>}
          <button type="button" onClick={() => setDone(false)}>다시 예약</button>
        </div>
      ) : (
        <form ref={formRef} onSubmit={submit} onFocusCapture={markReservationStart} onInvalidCapture={() => { allowDuplicateSubmit.current = false; }}>
          {s.fields?.name !== false && (
            <FormFieldShell q={{ label: '이름', required: required.name !== false, type: 'name' }}>
              <input placeholder="이름을 입력해주세요" required={required.name !== false} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </FormFieldShell>
          )}

          {s.fields?.phone !== false && (
            <FormFieldShell q={{ label: '연락처', required: required.phone !== false, type: 'phone' }}>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="01000000000"
                required={required.phone !== false}
                value={digitsOnly(f.phone)}
                onChange={(e) => setF({ ...f, phone: digitsOnly(e.target.value) })}
              />
            </FormFieldShell>
          )}

          <FormFieldShell q={{ label: '방문 날짜', required: true, type: 'date' }}>
            <input
              type="date"
              required
              min={todayDate()}
              value={f.date}
              onChange={(e) => { setF({ ...f, date: e.target.value, time: '' }); setError(''); setDuplicatePrompt(''); }}
            />
          </FormFieldShell>

          {f.date && !available && (
            <div className="reservation-error">예약 가능한 요일이 아닙니다. {weekdayLabelText(days)} 중 선택해주세요.</div>
          )}

          <FormFieldShell q={{ label: '방문 시간', required: true, type: 'time' }}>
            <select required value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} disabled={!available}>
              <option value="">시간 선택</option>
              {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormFieldShell>

          {customFields.map((field) => (
            <ReservationCustomField
              key={field.id}
              field={field}
              value={f.custom?.[field.id] || ''}
              onChange={(value) => setCustomValue(field.id, value)}
            />
          ))}

          <label className="agree">
            <input type="checkbox" required />
            <span>개인정보 수집 및 이용에 동의합니다.</span>
            <b>*</b>
          </label>

          {error && <div className="reservation-error">{error}</div>}
          <PreviewInlineNotice
            tone="warning"
            message={duplicatePrompt}
            actionLabel="다시 접수"
            onAction={requestDuplicateSubmit}
          />

          <button type="submit" disabled={!available || submitting}>{submitting ? '접수 중' : (s.submit || '방문예약 신청하기')}</button>
        </form>
      )}
    </section>
  );
}

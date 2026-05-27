import { useEffect, useState } from 'react';
import { pickSafe, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

const TIMER_URGENCY_LABELS = {
  normal: '진행 중',
  six: '6시간 이내',
  three: '3시간 이내',
  two: '2시간 이내',
  one: '1시간 이내',
  critical: '마감 임박',
  ended: '종료',
};

function TimerUnit({ value, label, effect = 'flip' }) {
  const safeValue = value == null || value === '' ? '00' : String(value);
  const displayValue = label === '일' ? safeValue : safeValue.padStart(2, '0');
  const isSecond = label === '초';
  return (
    <div className={`timer-unit timer-unit-${effect} ${isSecond ? 'is-second' : ''}`}>
      <b key={displayValue}>{displayValue}</b>
      <span>{label}</span>
    </div>
  );
}

export function getTimerTarget(settings = {}) {
  const mode = settings.repeatMode || settings.timerMode || 'fixed';
  if (mode === 'daily24') {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { target: next.getTime(), cycle: Math.max(1, next.getTime() - start.getTime()), repeat: true };
  }
  const target = settings.endAt || settings.timerEndAt;
  return { target: target ? new Date(target).getTime() : Date.now() + 1000 * 60 * 60 * 24 * 3, cycle: 1000 * 60 * 60 * 24 * 3, repeat: false };
}

export function useCountdown(input) {
  const settings = typeof input === 'object' ? input : { endAt: input };
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const data = getTimerTarget(settings);
  const diff = Math.max(0, data.target - now);
  const progress = data.repeat
    ? Math.max(0, Math.min(100, 100 - (diff / data.cycle) * 100))
    : Math.max(0, Math.min(100, 100 - (diff / (data.cycle || 1)) * 100));

  return {
    done: !data.repeat && diff <= 0,
    d: Math.floor(diff / (1000 * 60 * 60 * 24)),
    h: String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0'),
    m: String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0'),
    s: String(Math.floor((diff / 1000) % 60)).padStart(2, '0'),
    progress,
    diffMs: diff,
  };
}

export function getTimerUrgency(diffMs = 0, done = false) {
  if (done) return 'ended';
  const min = diffMs / 60000;
  if (min <= 10) return 'critical';
  if (min <= 60) return 'one';
  if (min <= 120) return 'two';
  if (min <= 180) return 'three';
  if (min <= 360) return 'six';
  return 'normal';
}

export function RenderTimer({ block, go }) {
  const s = block.s || {};
  const t = useCountdown(s);
  const urgency = getTimerUrgency(t.diffMs, t.done);
  const align = pickSafe(s.align, ['left', 'center', 'right'], 'center');
  const theme = pickSafe(s.timerTheme || 'modern', ['modern', 'glass', 'minimal', 'accent'], 'modern');
  const effect = pickSafe(s.urgentStyle || 'flip', ['flip', 'line', 'flow', 'none'], 'flip');
  const showProgress = effect !== 'none';
  const showDays = Number(t.d) > 0;

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section timer timer-modern-wrap align-${align} timer-theme-${theme} timer-effect-${effect} timer-urgency-${urgency} ${showDays ? 'timer-has-days' : 'timer-no-days'} ${urgency !== 'normal' && urgency !== 'ended' ? 'timer-is-imminent' : ''} ${widgetBoxClass(s)}`}
      style={widgetBoxVars(s)}
    >
      <div className="timer-headline">
        <span>{s.label || '혜택 마감까지'}</span>
        <em>{TIMER_URGENCY_LABELS[urgency] || '진행 중'}</em>
      </div>

      {t.done ? (
        <strong className="timer-ended">{s.ended || '종료되었습니다'}</strong>
      ) : (
        <>
          <div className="timer-grid timer-grid-modern">
            {showDays ? <TimerUnit value={t.d} label="일" effect={effect} /> : null}
            <TimerUnit value={t.h} label="시" effect={effect} />
            <TimerUnit value={t.m} label="분" effect={effect} />
            <TimerUnit value={t.s} label="초" effect={effect} />
          </div>
          {showProgress ? <div className="timer-progress-modern"><em style={{ width: `${t.progress}%` }}></em></div> : null}
        </>
      )}

      {s.cta ? <button className="timer-cta" onClick={() => go?.(s.ctaTarget, s.ctaUrl, s.ctaLabel)}>{s.ctaLabel || '상담 신청'}</button> : null}
    </section>
  );
}

function activityMinutesAgo(value) {
  const t = new Date(value || Date.now()).getTime();
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

function maskCustomerName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '고객';
  return `${raw[0]}**`;
}

function activityLiveSummary(leads = []) {
  const now = Date.now();
  const today = leads.filter((lead) => {
    const t = new Date(lead.createdAt || 0).getTime();
    return now - t < 24 * 60 * 60 * 1000;
  });
  const reservations = today.filter((lead) => lead.type === '방문예약').length;
  const forms = today.length - reservations;
  return { total: today.length, forms, reservations, latest: leads[0], today };
}

const SAMPLE_ACTIVITY_FEED = [
  { name: '김도윤', type: '상담', ago: '방금' },
  { name: '이서준', type: '방문예약', ago: '1분 전' },
  { name: '박민지', type: '상담', ago: '3분 전' },
  { name: '최서연', type: '상담', ago: '5분 전' },
  { name: '정하윤', type: '방문예약', ago: '8분 전' },
  { name: '한지우', type: '상담', ago: '12분 전' },
];

function sampleActivityRows(kind = 'both') {
  const targetType = kind === 'consult' ? '상담' : kind === 'reservation' ? '방문예약' : '';
  return SAMPLE_ACTIVITY_FEED
    .filter((row) => !targetType || row.type === targetType)
    .map((row, idx) => ({ id: `sample-${kind}-${idx}`, name: maskCustomerName(row.name), type: row.type, ago: row.ago }));
}

function activityRowsFromLeads(leads = []) {
  return leads.slice(0, 8).map((lead) => ({
    id: lead.id,
    name: maskCustomerName(lead.name),
    type: lead.type === '방문예약' ? '방문예약' : '상담',
    ago: activityMinutesAgo(lead.createdAt),
  }));
}

export function RenderActivity({ block, leads = [] }) {
  const s = block.s || {};
  const [tick, setTick] = useState(0);
  const source = pickSafe(s.dataSource || 'sample', ['live', 'sample'], 'sample');
  const mode = pickSafe(s.mode || 'feed', ['feed', 'count'], 'feed');
  const style = pickSafe(s.style || 'glass', ['minimal', 'glass', 'dark'], 'glass');
  const anim = pickSafe(s.animation || 'stack', ['stack', 'none'], 'stack');
  const align = pickSafe(s.align || 'left', ['left', 'center', 'right'], 'left');
  const sampleKind = pickSafe(s.sampleKind || 'both', ['consult', 'reservation', 'both'], 'both');
  const live = activityLiveSummary(leads);

  const baseRows = source === 'live'
    ? activityRowsFromLeads(leads)
    : sampleActivityRows(sampleKind);

  const fallbackRows = sampleActivityRows(sampleKind).slice(0, 4);
  const rows = baseRows.length ? baseRows : fallbackRows;
  const rotated = rows.map((_, i) => rows[(i + tick) % rows.length]).slice(0, 4);
  const count = source === 'live' ? live.total : Math.max(0, Number(s.baseCount ?? 12)) + (Math.floor(Date.now() / 120000) % 3);

  useEffect(() => {
    if (anim === 'none') return undefined;
    const timer = setInterval(() => setTick((v) => (v + 1) % Math.max(1, rows.length)), 2400);
    return () => clearInterval(timer);
  }, [anim, rows.length]);

  return (
    <section id={`block-${block.id}`} className={`landing-section activity-widget activity-stack-widget activity-${style} activity-mode-${mode} activity-anim-${anim} align-${align}`}>
      <div className="activity-stack-head">
        <div>
          <span className="activity-live-dot"></span>
          <strong>{s.title || '실시간 접수현황'}</strong>
        </div>
      </div>

      {mode === 'count' ? (
        <div className="activity-count-simple">
          <b>{count}</b>
          <span>오늘 접수</span>
          <small>{source === 'live' ? `상담 ${live.forms} · 예약 ${live.reservations}` : '최근 접수 기준'}</small>
        </div>
      ) : (
        <div className="activity-feed-stack">
          {rotated.map((row, idx) => (
            <div className="activity-feed-row" key={`${row.id}-${tick}-${idx}`}>
              <span>{row.name}님</span>
              <b>{row.type} 접수</b>
              <small>{row.ago}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

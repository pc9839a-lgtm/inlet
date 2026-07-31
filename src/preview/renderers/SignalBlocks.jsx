import { useEffect, useState } from 'react';
import { pickSafe, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

const TIMER_BASE_CLASS = 'timer-theme-minimal timer-effect-none';
const TIMER_VARIANTS = ['clean', 'cards', 'promo'];
const TIMER_PALETTES = ['ink', 'blue', 'green', 'coral', 'accent'];
const TIMER_EFFECTS = ['none', 'slide', 'flip', 'pulse', 'fire'];

function TimerUnit({ value, label, effect = 'none' }) {
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

function timerVariant(settings = {}) {
  const legacyThemeVariant = {
    modern: 'cards',
    glass: 'promo',
    accent: 'promo',
    minimal: 'clean',
  }[settings.timerTheme];
  const legacyVariant = {
    minimal: 'clean',
    line: 'clean',
    flat: 'cards',
    point: 'cards',
    block: 'promo',
  }[settings.timerVariant];
  return pickSafe(legacyVariant || settings.timerVariant || legacyThemeVariant || 'clean', TIMER_VARIANTS, 'clean');
}

function timerPalette(settings = {}) {
  return pickSafe(settings.timerPalette || 'ink', TIMER_PALETTES, 'ink');
}

function timerEffect(settings = {}) {
  const legacyUrgencyEffect = {
    flip: 'flip',
    flow: 'slide',
    line: 'pulse',
  }[settings.urgentStyle];
  const legacyMotionEffect = settings.timerMotion ? 'slide' : '';
  return pickSafe(settings.timerEffect || legacyUrgencyEffect || legacyMotionEffect || 'none', TIMER_EFFECTS, 'none');
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

export function RenderBottomTimer({ settings = {} }) {
  const t = useCountdown(settings);
  const variant = timerVariant(settings);
  const palette = timerPalette(settings);
  const effect = timerEffect(settings);
  const hasDays = Number(t.d) > 0;
  const rawLabel = String(settings.label ?? '').trim();
  const label = (rawLabel || '혜택 마감까지').slice(0, 40);
  const promoBadge = String(settings.promoBadge ?? '마감 임박').trim().slice(0, 16);
  const compactLabel = variant === 'promo' && promoBadge ? `${promoBadge} · ${label}` : label;
  const endedLabel = String(settings.ended || '이벤트가 종료되었습니다.').slice(0, 40);
  const tickKey = `${t.d}-${t.h}-${t.m}-${t.s}`;
  const tickClass = effect !== 'none' && !t.done ? 'is-bottom-timer-tick' : '';
  const progress = Math.max(0, Math.min(100, Number(t.progress || 0)));

  return (
    <div
      className={`bottom-timer bottom-timer-minimal bottom-timer-variant-${variant} bottom-timer-palette-${palette} bottom-timer-effect-${effect} ${hasDays ? 'bottom-timer-has-days' : 'bottom-timer-no-days'} ${t.done ? 'bottom-timer-ended' : ''} ${tickClass}`.trim()}
      data-timer-label={t.done ? endedLabel : compactLabel}
      data-timer-badge=""
      data-timer-tick={tickKey}
      style={{ '--bottom-timer-progress': `${progress}%` }}
    >
      <div className="bottom-timer-main" data-timer-badge="">
        <strong>
          {hasDays ? <em>D-{t.d}</em> : null}
          <b key={`${effect}-${tickKey}`}>{t.h}:{t.m}:{t.s}</b>
        </strong>
      </div>
    </div>
  );
}

export function RenderTimer({ block }) {
  const s = block.s || {};
  const t = useCountdown(s);
  const showDays = Number(t.d) > 0;
  const variant = timerVariant(s);
  const palette = timerPalette(s);
  const effect = timerEffect(s);
  const motion = effect === 'none' ? 'off' : 'on';
  const label = String(s.label ?? '혜택 마감까지').slice(0, 40);
  const promoBadge = String(s.promoBadge ?? '마감 임박').slice(0, 16);

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section timer timer-modern-wrap ${TIMER_BASE_CLASS} timer-variant-${variant} timer-palette-${palette} timer-effect-${effect} timer-motion-${motion} ${showDays ? 'timer-has-days' : 'timer-no-days'} ${widgetBoxClass(s, { background: false, shadow: false })}`}
      style={widgetBoxVars(s)}
    >
      {t.done ? (
        <strong className="timer-ended">{s.ended || '종료되었습니다.'}</strong>
      ) : (
        <>
          {(label || (variant === 'promo' && promoBadge)) && (
            <div className="timer-topline">
              {label && <span>{label}</span>}
              {variant === 'promo' && promoBadge && <em>{promoBadge}</em>}
            </div>
          )}
          <div className="timer-grid timer-grid-modern">
            {showDays ? <TimerUnit value={t.d} label="일" effect={effect} /> : null}
            <TimerUnit value={t.h} label="시" effect={effect} />
            <TimerUnit value={t.m} label="분" effect={effect} />
            <TimerUnit value={t.s} label="초" effect={effect} />
          </div>
          <div className="timer-progress-solid" aria-hidden="true">
            <i style={{ width: `${t.progress}%` }} />
          </div>
        </>
      )}
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
    <section id={`block-${block.id}`} className={`landing-section activity-widget activity-stack-widget activity-${style} activity-mode-${mode} activity-anim-${anim} ${widgetBoxClass(s, { background: false, shadow: false })}`} style={widgetBoxVars(s)}>
      {(s.title ?? '실시간 접수현황') && <div className="activity-stack-head">
        <div>
          <span className="activity-live-dot"></span>
          <strong>{s.title ?? '실시간 접수현황'}</strong>
        </div>
      </div>}

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

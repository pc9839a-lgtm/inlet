import { pickSafe, rich } from './previewUtils.jsx';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function compactAddress(map = {}) {
  return [map.address, map.detailAddress]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

function mapQuery(map = {}) {
  return compactAddress(map) || String(map.placeName || map.title || '').trim();
}

function hasSpecificMapQuery(map = {}) {
  const address = compactAddress(map);
  const place = String(map.placeName || map.title || '').trim();
  if (address) return true;
  return !!place && !['오시는 길', '지도', '지도 정보', '위치'].includes(place);
}

function googleMapSrc(map = {}) {
  const query = mapQuery(map);
  if (!query || !hasSpecificMapQuery(map)) return '';
  const params = new URLSearchParams({
    q: query,
    output: 'embed',
    hl: 'ko',
    z: '16',
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

function mapOpenUrl(map = {}) {
  const query = mapQuery(map);
  if (!query) return 'https://www.google.com/maps';
  if (map.mapMode === 'osm_fallback') {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function RenderMap({ block }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout || 'default', ['default', 'full', 'minimal'], 'default');
  const height = pickSafe(s.height || 'medium', ['small', 'medium', 'large'], 'medium');
  const src = s.mapMode === 'osm_fallback' ? '' : googleMapSrc(s);
  const openUrl = mapOpenUrl(s);
  const address = compactAddress(s);
  const hasQuery = !!mapQuery(s);
  const specificQuery = hasSpecificMapQuery(s);

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section inlet-map-section map-widget map-${layout} map-height-${height}`}
    >
      {(s.title || s.placeName || address || s.phone || s.parkingText) && (
        <div className="map-widget-head">
          {(s.title || s.placeName) && <h2>{rich(s.title || s.placeName)}</h2>}
          {address && <p>{address}</p>}
          {s.phone && <p>{s.phone}</p>}
          {s.parkingText && <p>{s.parkingText}</p>}
        </div>
      )}

      {src ? (
        <iframe
          title={s.placeName || s.title || '지도'}
          src={src}
          width="100%"
          height="380"
          style={{ border: 0, borderRadius: 20, overflow: 'hidden' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="map-placeholder">
          <strong>{s.placeName || s.title || '지도 정보'}</strong>
          <span>{hasQuery ? '지도 미리보기가 제한될 수 있어 새 창에서 확인할 수 있습니다.' : '장소명 또는 주소를 입력해주세요.'}</span>
        </div>
      )}

      {hasQuery && (
        <a className="map-open-link" href={openUrl} target="_blank" rel="noreferrer">
          {specificQuery ? '지도 새창으로 보기' : '장소명을 더 구체적으로 입력하기'}
        </a>
      )}
    </section>
  );
}

function parseScheduleDate(value = '') {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+09:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatScheduleDate(date) {
  if (!date) return '';
  const day = WEEKDAYS[date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${day}요일`;
}

function calendarDays(date) {
  if (!date) return [];
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: first.getDay() }, () => null);
  return [...blanks, ...Array.from({ length: last }, (_, index) => index + 1)];
}

export function RenderSchedule({ block }) {
  const s = block.s || {};
  const date = parseScheduleDate(s.date);
  const selectedDay = date?.getDate();
  const days = calendarDays(date);
  const title = s.title || '일정 안내';
  const monthLabel = s.monthLabel || (date ? `${date.getMonth() + 1}월` : '');
  const align = pickSafe(s.align || 'center', ['left', 'center', 'right'], 'center');

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section schedule-widget schedule-align-${align}`}
      style={{
        '--schedule-accent': s.highlightColor || 'var(--accent)',
        '--schedule-card': s.cardBgColor || 'var(--card)',
        '--schedule-text': s.textColor || 'var(--text)',
      }}
    >
      {title && <h2>{rich(title)}</h2>}
      {date && <p className="schedule-date-line">{formatScheduleDate(date)}</p>}
      {s.body && <p className="schedule-body">{rich(s.body)}</p>}
      {monthLabel && <strong className="schedule-month">{monthLabel}</strong>}
      <div className="schedule-calendar" aria-label={title}>
        {WEEKDAYS.map((day) => <b key={day}>{day}</b>)}
        {days.map((day, index) => (
          <span key={`${day || 'blank'}-${index}`} className={day === selectedDay ? 'active' : ''}>{day || ''}</span>
        ))}
      </div>
    </section>
  );
}

function normalizeFaqItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: item.id || `${item.q || item.question || ''}-${item.a || item.answer || ''}`,
      q: item.q || item.question || '',
      a: item.a || item.answer || '',
    }))
    .filter((item) => item.q || item.a);
}

export function RenderFaq({ block }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout || 'accordion', ['accordion', 'card', 'plain'], 'accordion');
  const items = normalizeFaqItems(s.items);

  return (
    <section id={`block-${block.id}`} className={`landing-section faq-widget faq-${layout}`}>
      {s.title && <h2>{rich(s.title)}</h2>}
      <div className="faq-list">
        {items.map((item, index) => (
          <details key={item.id || index} open={index === 0 && s.firstOpen !== false}>
            <summary>{rich(item.q || `질문 ${index + 1}`)}</summary>
            <p>{rich(item.a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

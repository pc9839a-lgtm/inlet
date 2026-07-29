import { pickSafe, rich, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

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
  return !!place && !['오시는 길', '지도', '지도 정보', '위치', '장소명을 입력해 주세요'].includes(place);
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

export function RenderMap({ block }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout || 'default', ['default', 'full', 'minimal'], 'default');
  const height = pickSafe(s.height || 'medium', ['small', 'medium', 'large'], 'medium');
  const align = pickSafe(s.align || 'left', ['left', 'center', 'right'], 'left');
  const src = s.mapMode === 'osm_fallback' ? '' : googleMapSrc(s);
  const address = compactAddress(s);
  const query = mapQuery(s);
  const hasQuery = !!query;
  const specificQuery = hasSpecificMapQuery(s);
  const showEmbedMap = s.showEmbedMap !== false;
  const showMapLinks = s.showMapLinks !== false && specificQuery;
  const safeMapUrl = (value, fallback) => {
    const url = String(value || '').trim();
    return /^(https?:\/\/|tmap:\/\/)/i.test(url) ? url : fallback;
  };
  const encodedQuery = encodeURIComponent(query);
  const mapLinks = [
    { id: 'tmap', label: '티맵', href: safeMapUrl(s.tmapUrl, `tmap://search?name=${encodedQuery}`) },
    { id: 'naver', label: '네이버 지도', href: safeMapUrl(s.naverMapUrl, `https://map.naver.com/p/search/${encodedQuery}`) },
    { id: 'kakao', label: '카카오맵', href: safeMapUrl(s.kakaoMapUrl, `https://map.kakao.com/link/search/${encodedQuery}`) },
  ];
  const transitRows = [
    { id: 'subway', title: '지하철 이용 시', body: s.subwayText, visible: s.showSubway !== false },
    { id: 'bus', title: '버스 이용 시', body: s.busText, visible: s.showBus !== false },
    { id: 'parking', title: '주차 안내', body: s.parkingText, visible: s.showParking !== false },
  ].filter((item) => item.visible && String(item.body || '').trim());

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section inlet-map-section map-widget location-guide map-${layout} map-height-${height} ${widgetBoxClass(s, { background: false, shadow: false })}`}
      style={{ ...widgetBoxVars(s), '--map-align': align, '--map-justify': align === 'left' ? 'start' : align === 'right' ? 'end' : 'center' }}
    >
      <header className="location-guide-heading">
        {s.eyebrow && <span>{s.eyebrow}</span>}
        <h2>{rich(s.sectionTitle || '오시는 길')}</h2>
      </header>

      {(s.placeName || address || s.phone) && (
        <div className="location-guide-place">
          {s.placeName && <strong>{rich(s.placeName)}</strong>}
          {address && <p>{address}</p>}
          {s.phone && <a href={`tel:${String(s.phone).replace(/[^\d+]/g, '')}`}>{s.phone}</a>}
        </div>
      )}

      {showMapLinks && (
        <nav className="location-guide-actions" aria-label="지도 앱에서 장소 열기">
          {mapLinks.map((item) => (
            <a key={item.id} className={`map-provider-${item.id}`} href={item.href} target="_blank" rel="noreferrer">
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {showEmbedMap && (src ? (
        <iframe
          title={s.placeName || s.title || '지도'}
          src={src}
          width="100%"
          height="380"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="map-placeholder">
          <strong>{s.placeName || s.title || '지도 정보'}</strong>
          <span>{hasQuery ? '지도 미리보기가 제한되어 지도 앱에서 확인할 수 있습니다.' : '장소명 또는 주소를 입력해 주세요.'}</span>
        </div>
      ))}

      {!!transitRows.length && (
        <div className="location-guide-transit">
          {transitRows.map((item) => (
            <section key={item.id} className={`location-guide-transit-${item.id}`}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </section>
          ))}
        </div>
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
  const title = s.title ?? '일정 안내';
  const monthLabel = s.monthLabel || (date ? `${date.getMonth() + 1}월` : '');
  const align = pickSafe(s.align || 'center', ['left', 'center', 'right'], 'center');

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section schedule-widget schedule-align-${align} ${widgetBoxClass(s, { background: false, shadow: false })}`}
      style={{
        ...widgetBoxVars(s),
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
      q: item.q ?? item.question ?? '',
      a: item.a ?? item.answer ?? '',
    }))
    .filter((item) => item.q);
}

export function RenderFaq({ block }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout || 'accordion', ['accordion', 'card', 'plain'], 'accordion');
  const items = normalizeFaqItems(s.items);

  return (
    <section id={`block-${block.id}`} className={`landing-section faq-widget faq-${layout} ${widgetBoxClass(s, { background: false, shadow: false })}`} style={widgetBoxVars(s)}>
      {s.title && <h2>{rich(s.title)}</h2>}
      <div className="faq-list">
        {items.map((item, index) => (
          <details key={item.id || index} open={index === 0 && s.firstOpen !== false}>
            <summary>{rich(item.q)}</summary>
            {item.a && <p>{rich(item.a)}</p>}
          </details>
        ))}
      </div>
    </section>
  );
}

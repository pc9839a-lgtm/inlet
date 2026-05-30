export const PERIOD_OPTIONS = [
  ['today', '오늘'],
  ['yesterday', '어제'],
  ['7d', '7일'],
  ['14d', '14일'],
  ['thisMonth', '이번 달'],
  ['lastMonth', '지난 달'],
];

export function countBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const value = item?.[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function statLabel(key) {
  return {
    page_view: '페이지뷰',
    cta_click: 'CTA 클릭',
    link_click: '링크 클릭',
    form_start: '폼 시작',
    form_submit_attempt: '상담 제출 시도',
    form_submit_success: '상담 제출 성공',
    form_submit: '상담 제출',
    reservation_submit_attempt: '예약 제출 시도',
    reservation_submit_success: '예약 제출 성공',
    reservation_success: '예약 성공',
    reservation_submit: '방문예약 제출',
    direct: '직접 유입',
    referral: '외부 링크',
    ads: '광고',
    naver: '네이버',
    google: '구글',
    kakao: '카카오',
    instagram: '인스타그램',
    facebook: '페이스북',
    youtube: '유튜브',
    mobile: '모바일',
    desktop: 'PC',
    tablet: '태블릿',
    unknown: '미확인',
    신규: '신규',
    확인중: '확인중',
    완료: '완료',
    보류: '보류',
    상담: '상담',
    예약: '예약',
  }[key] || key;
}

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getPeriodRange(period, now = new Date()) {
  const today = seoulParts(now);
  let start = seoulDate(today.year, today.month, today.day);
  let end = endOfSeoulDay(start);

  if (period === 'yesterday') {
    start = addSeoulDays(start, -1);
    end = endOfSeoulDay(start);
  } else if (period === '14d') {
    start = addSeoulDays(start, -13);
  } else if (period === 'thisMonth') {
    start = seoulDate(today.year, today.month, 1);
  } else if (period === 'lastMonth') {
    start = seoulDate(today.year, today.month - 1, 1);
    end = endOfSeoulDay(seoulDate(today.year, today.month, 0));
  } else if (period !== 'today') {
    start = addSeoulDays(start, -6);
  }

  return { start, end };
}

export function buildStats(events = [], leads = [], period = '7d', now = new Date()) {
  const range = getPeriodRange(period, now);
  const buckets = trendBuckets(range);
  const bucketMap = Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket]));
  const filteredEvents = [];
  const filteredLeads = [];
  const seenEventIds = new Set();
  const seenLeadIds = new Set();
  const statusData = {};
  const deliveryData = {};
  const typeData = { 상담: 0, 예약: 0 };
  let pv = 0;
  let cta = 0;
  let link = 0;
  let formStart = 0;
  let submitAttempt = 0;
  let submitSuccess = 0;
  let reservationAttempt = 0;
  let reservationSuccess = 0;

  (events || []).forEach((event) => {
    if (isDuplicateItem(event, seenEventIds)) return;
    if (!inRange(event, range)) return;
    filteredEvents.push(event);
    const bucket = bucketMap[dayId(event.createdAt)];
    if (event.type === 'page_view') {
      pv += 1;
      if (bucket) bucket.pv += 1;
    } else if (event.type === 'cta_click') {
      cta += 1;
      if (bucket) bucket.cta += 1;
    } else if (event.type === 'link_click') {
      link += 1;
    } else if (event.type === 'form_start') {
      formStart += 1;
    } else if (event.type === 'form_submit_attempt' || event.type === 'form_submit') {
      submitAttempt += 1;
    } else if (event.type === 'form_submit_success') {
      submitSuccess += 1;
    } else if (event.type === 'reservation_submit_attempt') {
      reservationAttempt += 1;
    } else if (isReservationSuccessEvent(event.type)) {
      reservationSuccess += 1;
    }
  });

  (leads || []).forEach((lead) => {
    if (isDuplicateItem(lead, seenLeadIds)) return;
    const item = normalizeStatsLead(lead);
    if (!inRange(item, range)) return;
    filteredLeads.push(item);
    const type = statsLeadKind(item) === 'reservation' ? '예약' : '상담';
    typeData[type] += 1;
    statusData[item.status] = (statusData[item.status] || 0) + 1;
    const deliveryKey = deliveryStatusLabel(item.delivery?.status || 'none');
    deliveryData[deliveryKey] = (deliveryData[deliveryKey] || 0) + 1;
    const bucket = bucketMap[dayId(item.createdAt)];
    if (bucket) bucket.db += 1;
  });

  const db = filteredLeads.length;
  return {
    filteredEvents,
    filteredLeads,
    pv,
    cta,
    link,
    formStart,
    submitAttempt,
    submitSuccess,
    reservationAttempt,
    reservationSuccess,
    consultLeads: typeData['상담'],
    reservationLeads: typeData['예약'],
    db,
    conversion: pv ? ((db / pv) * 100).toFixed(1) : '0.0',
    ctaConversion: cta ? ((db / cta) * 100).toFixed(1) : '0.0',
    formStartRate: pv ? ((formStart / pv) * 100).toFixed(1) : '0.0',
    formCompletionRate: submitAttempt ? ((submitSuccess / submitAttempt) * 100).toFixed(1) : '0.0',
    reservationCompletionRate: reservationAttempt ? ((reservationSuccess / reservationAttempt) * 100).toFixed(1) : '0.0',
    funnel: {
      pageViews: pv,
      ctaClicks: cta,
      linkClicks: link,
      formStarts: formStart,
      submitAttempts: submitAttempt,
      submitSuccesses: submitSuccess,
      reservationAttempts: reservationAttempt,
      reservationSuccesses: reservationSuccess,
    },
    trend: buckets,
    statusData,
    deliveryData,
    typeData,
  };
}

function isReservationSuccessEvent(type) {
  return ['reservation_submit', 'reservation_submit_success', 'reservation_success'].includes(type);
}

function isDuplicateItem(item = {}, seenIds) {
  const key = statsDedupeKey(item);
  if (!key) return false;
  if (seenIds.has(key)) return true;
  seenIds.add(key);
  return false;
}

function statsDedupeKey(item = {}) {
  if (item?.id != null && String(item.id).trim()) return `id:${String(item.id).trim()}`;
  const createdAt = item.createdAt || item.savedAt || '';
  const type = item.type || '';
  const contact = item.phone || item.email || item.address || '';
  const name = item.name || '';
  const label = item.label || item.sourceBlockTitle || item.message || '';
  const channel = item.channel || '';
  const device = item.device || '';
  const signature = [createdAt, type, contact, name, label, channel, device]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');
  return signature.replace(/\|/g, '') ? `sig:${signature}` : '';
}

function normalizeStatsLead(lead = {}) {
  const delivery = lead.delivery || {};
  return {
    ...lead,
    status: lead.status || '신규',
    createdAt: lead.createdAt || lead.savedAt || new Date().toISOString(),
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    values: lead.values || {},
    delivery: {
      status: delivery.status || 'none',
      summary: delivery.summary || '',
      logs: Array.isArray(delivery.logs) ? delivery.logs : [],
    },
  };
}

function statsLeadKind(lead = {}) {
  const values = lead.values && typeof lead.values === 'object' ? Object.keys(lead.values).join(' ') : '';
  const answers = Array.isArray(lead.answers) ? lead.answers.map((answer) => answer.label || '').join(' ') : '';
  const text = [lead.type, lead.sourceBlockTitle, lead.message, values, answers].join(' ').toLowerCase();
  return /예약|방문|방문예약|reservation|booking|reserve/.test(text) ? 'reservation' : 'consult';
}

function deliveryStatusLabel(status = 'none') {
  return {
    pending: '전송중',
    success: '전송완료',
    failed: '전송실패',
    partial: '일부실패',
    none: '전송없음',
  }[status] || status || '전송없음';
}

function parseTime(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function inRange(item, range) {
  const time = parseTime(item.createdAt);
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function dayId(value) {
  const parts = seoulParts(value);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function dayLabel(value) {
  const parts = seoulParts(value);
  if (!parts) return '';
  return `${parts.month}/${parts.day}`;
}

function trendBuckets(range) {
  const days = [];
  let cur = seoulDateFromInstant(range.start);

  while (cur <= range.end && days.length < 32) {
    days.push({
      id: dayId(cur),
      label: dayLabel(cur),
      pv: 0,
      cta: 0,
      db: 0,
    });
    cur = addSeoulDays(cur, 1);
  }

  return days.length ? days : [{ id: dayId(new Date()), label: dayLabel(new Date()), pv: 0, cta: 0, db: 0 }];
}

function percent(num, den) {
  return den ? ((num / den) * 100).toFixed(1) : '0.0';
}

function seoulParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const shifted = new Date(date.getTime() + SEOUL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function seoulDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day) - SEOUL_OFFSET_MS);
}

function seoulDateFromInstant(value) {
  const parts = seoulParts(value);
  return seoulDate(parts.year, parts.month, parts.day);
}

function endOfSeoulDay(start) {
  return new Date(start.getTime() + DAY_MS - 1);
}

function addSeoulDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

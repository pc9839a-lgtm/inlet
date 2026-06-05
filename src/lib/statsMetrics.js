import { trafficChannelFromItem } from './trafficAttribution.js';

export const PERIOD_OPTIONS = [
  ['1d', '1일'],
  ['7d', '7일'],
  ['14d', '14일'],
  ['30d', '30일'],
];

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function countBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const value = item?.[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function countByValue(items, picker) {
  return (items || []).reduce((acc, item) => {
    const value = picker(item) || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export function statLabel(key) {
  return {
    page_view: '페이지 조회',
    cta_click: 'CTA 클릭',
    link_click: '링크 클릭',
    form_start: '폼 시작',
    form_submit_attempt: '상담 제출 시도',
    form_submit_success: '상담 제출 완료',
    form_submit: '상담 제출',
    reservation_submit_attempt: '예약 제출 시도',
    reservation_submit_success: '예약 제출 완료',
    reservation_success: '예약 완료',
    reservation_submit: '방문예약 제출',
    direct: '직접 유입',
    referral: '외부 링크',
    ads: '광고',
    naver: '네이버',
    google: '구글',
    kakao: '카카오',
    instagram: '인스타그램',
    facebook: '페이스북',
    meta: '메타',
    youtube: '유튜브',
    mobile: '모바일',
    desktop: 'PC',
    tablet: '태블릿',
    unknown: '미확인',
    new: '신규',
    pending: '확인중',
    confirmed: '확인중',
    done: '완료',
    completed: '완료',
    hold: '보류',
    신규: '신규',
    확인중: '확인중',
    연락완료: '연락완료',
    예약완료: '예약완료',
    보류: '보류',
    종료: '종료',
    상담: '상담',
    예약: '예약',
  }[key] || key;
}

export function getPeriodRange(period, now = new Date()) {
  const today = seoulParts(now);
  let start = seoulDate(today.year, today.month, today.day);
  let end = endOfSeoulDay(start);

  if (period === '1d' || period === 'today') {
    start = addSeoulDays(start, 0);
  } else if (period === 'yesterday') {
    start = addSeoulDays(start, -1);
    end = endOfSeoulDay(start);
  } else if (period === '14d') {
    start = addSeoulDays(start, -13);
  } else if (period === '30d') {
    start = addSeoulDays(start, -29);
  } else if (period === 'thisMonth') {
    start = seoulDate(today.year, today.month, 1);
  } else if (period === 'lastMonth') {
    start = seoulDate(today.year, today.month - 1, 1);
    end = endOfSeoulDay(seoulDate(today.year, today.month, 0));
  } else {
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
  const typeData = { 상담: 0, 예약: 0 };
  const ctaLabelData = {};
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
      ctaLabelData[event.label || 'unknown'] = (ctaLabelData[event.label || 'unknown'] || 0) + 1;
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
    consultLeads: typeData.상담,
    reservationLeads: typeData.예약,
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
    typeData,
    channelData: countByValue(filteredEvents, trafficChannelFromItem),
    deviceData: countBy(filteredEvents, 'device'),
    ctaLabelData,
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
  const signature = [
    item.createdAt || item.savedAt || '',
    item.type || '',
    item.phone || item.email || item.address || '',
    item.name || '',
    item.label || item.sourceBlockTitle || item.message || '',
    item.channel || '',
    item.utmSource || item.utm_source || '',
    item.sourceUrl || item.source_url || item.url || '',
    item.device || '',
  ].map((value) => String(value || '').trim().toLowerCase()).join('|');
  return signature.replace(/\|/g, '') ? `sig:${signature}` : '';
}

function normalizeStatsLead(lead = {}) {
  return {
    ...lead,
    status: lead.status || '신규',
    createdAt: lead.createdAt || lead.savedAt || new Date().toISOString(),
    answers: Array.isArray(lead.answers) ? lead.answers : [],
    values: lead.values || {},
  };
}

function statsLeadKind(lead = {}) {
  const values = lead.values && typeof lead.values === 'object' ? Object.keys(lead.values).join(' ') : '';
  const answers = Array.isArray(lead.answers) ? lead.answers.map((answer) => answer.label || '').join(' ') : '';
  const text = [lead.type, lead.sourceBlockTitle, lead.message, values, answers].join(' ').toLowerCase();
  return /예약|방문|방문예약|reservation|booking|reserve/.test(text) ? 'reservation' : 'consult';
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
    days.push({ id: dayId(cur), label: dayLabel(cur), pv: 0, cta: 0, db: 0 });
    cur = addSeoulDays(cur, 1);
  }
  return days.length ? days : [{ id: dayId(new Date()), label: dayLabel(new Date()), pv: 0, cta: 0, db: 0 }];
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

const MONTH_RE = /^\d{4}-\d{2}$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function currentMonthValue(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function normalizeMonthValue(value = '', fallback = currentMonthValue()) {
  const text = String(value || '').trim();
  return MONTH_RE.test(text) ? text : fallback;
}

export function monthDateRange(month = currentMonthValue()) {
  const safe = normalizeMonthValue(month);
  const [year, monthIndex] = safe.split('-').map(Number);
  const end = new Date(year, monthIndex, 0);
  return {
    month: safe,
    dateFrom: `${year}-${pad(monthIndex)}-01`,
    dateTo: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

export function clampDateRangeToMonth(range = {}, month = currentMonthValue()) {
  const monthRange = monthDateRange(month);
  const dateFrom = range.dateFrom && range.dateFrom > monthRange.dateFrom ? range.dateFrom : monthRange.dateFrom;
  const dateTo = range.dateTo && range.dateTo < monthRange.dateTo ? range.dateTo : monthRange.dateTo;
  return { ...monthRange, dateFrom, dateTo };
}

export function statsDateRange(month = currentMonthValue(), period = '30d', now = new Date()) {
  const monthRange = monthDateRange(month);
  const safePeriod = ['1d', '7d', '14d', '30d'].includes(String(period || '')) ? String(period) : '30d';
  const currentMonth = currentMonthValue(now);
  const monthEnd = parseDateOnly(monthRange.dateTo);
  const today = parseDateOnly(toDateOnly(now));
  const end = month === currentMonth && today < monthEnd ? today : monthEnd;
  const days = Number(safePeriod.replace('d', '')) || 30;
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  const monthStart = parseDateOnly(monthRange.dateFrom);
  const clampedStart = start < monthStart ? monthStart : start;
  return {
    ...monthRange,
    period: safePeriod,
    dateFrom: toDateOnly(clampedStart),
    dateTo: toDateOnly(end),
  };
}

function parseDateOnly(value = '') {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnly(value = new Date()) {
  const date = value instanceof Date ? value : parseDateOnly(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

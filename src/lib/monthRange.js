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

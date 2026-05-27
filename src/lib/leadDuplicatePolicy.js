const WINDOW_MS = {
  '1d': 86400000,
  '24h': 86400000,
  '3d': 259200000,
  '7d': 604800000,
  '30d': 2592000000,
};

export function normalizeDuplicateWindow(value = '1d') {
  if (value === '1h' || value === '24h' || value === 'forever') return '1d';
  return Object.prototype.hasOwnProperty.call(WINDOW_MS, value) ? value : '1d';
}

export function duplicateWindowMs(value = '1d') {
  return WINDOW_MS[normalizeDuplicateWindow(value)] || WINDOW_MS['1d'];
}

export function normalizeLeadContact(value = '') {
  return String(value || '').replace(/[^\d+a-zA-Z@._-]/g, '').toLowerCase();
}

export function normalizeLeadPhone(value = '') {
  return String(value || '').replace(/[^0-9+]/g, '');
}

export function duplicateStoreKey(formId) {
  return `inlet-duplicate-${formId || 'default'}`;
}

export function pruneDuplicateItems(items = [], settings = {}, now = Date.now()) {
  const windowMs = duplicateWindowMs(settings.duplicateWindow || settings.duplicateWindowKey || '1d');
  return (Array.isArray(items) ? items : []).filter((item) => now - Number(item.time || 0) <= windowMs);
}

export function getDuplicateItems(formId, storage = safeLocalStorage()) {
  try {
    return JSON.parse(storage?.getItem(duplicateStoreKey(formId)) || '[]');
  } catch {
    return [];
  }
}

export function checkDuplicateLead(formId, values = {}, settings = {}, storage = safeLocalStorage(), now = Date.now()) {
  const items = pruneDuplicateItems(getDuplicateItems(formId, storage), settings, now);
  return checkDuplicateLeadItems(items, values, settings);
}

export function checkDuplicateLeadItems(items = [], values = {}, settings = {}) {
  const phone = normalizeLeadContact(values.phone);
  const email = normalizeLeadContact(values.email);
  const phoneHit = !!phone && items.some((item) => normalizeLeadContact(item.phone) === phone);
  const emailHit = !!email && items.some((item) => normalizeLeadContact(item.email) === email);

  if (phoneHit && settings.duplicatePhone === 'block') return duplicateResult('blocked', 'phone');
  if (emailHit && settings.duplicateEmail === 'block') return duplicateResult('blocked', 'email');
  if (phoneHit && settings.duplicatePhone === 'warn') return duplicateResult('warned', 'phone');
  if (emailHit && settings.duplicateEmail === 'warn') return duplicateResult('warned', 'email');
  return { blocked: false, warned: false };
}

export function rememberDuplicateLead(formId, values = {}, settings = {}, storage = safeLocalStorage(), now = Date.now()) {
  if (!storage) return;
  const items = pruneDuplicateItems(getDuplicateItems(formId, storage), settings, now);
  items.unshift({
    phone: normalizeLeadContact(values.phone),
    email: normalizeLeadContact(values.email),
    time: now,
  });
  try {
    storage.setItem(duplicateStoreKey(formId), JSON.stringify(items.slice(0, 100)));
  } catch {}
}

export function sameLeadKind(a = {}, b = {}) {
  return leadKind(a) === leadKind(b);
}

export function leadKind(lead = {}) {
  return isReservationLead(lead) ? 'reservation' : 'consult';
}

export function isReservationLead(lead = {}) {
  const values = lead.values && typeof lead.values === 'object' ? Object.keys(lead.values).join(' ') : '';
  const answers = Array.isArray(lead.answers) ? lead.answers.map((answer) => answer.label || '').join(' ') : '';
  const text = [lead.type, lead.sourceBlockTitle, lead.message, values, answers].join(' ').toLowerCase();
  return /예약|방문|방문예약|reservation|booking|reserve/.test(text);
}

function duplicateResult(kind, reason) {
  const message = reason === 'email' ? '이미 접수된 이메일입니다.' : '이미 접수된 연락처입니다.';
  return {
    blocked: kind === 'blocked',
    warned: kind === 'warned',
    reason,
    message,
  };
}

function safeLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

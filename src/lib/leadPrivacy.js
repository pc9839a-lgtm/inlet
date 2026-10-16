// PII masking is presentation-only. Raw values remain available in an explicitly
// opened lead detail and in a deliberately confirmed export, not in list rows.
export function maskLeadName(name = '') {
  const value = String(name || '').trim();
  if (!value) return '이름 없음';
  return [...value][0] + '**';
}

export function maskLeadContact(contact = '') {
  const value = String(contact || '').trim();
  if (!value) return '-';
  if (value.includes('@')) {
    const at = value.lastIndexOf('@');
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    if (!domain || !local) return '***';
    return local.slice(0, 1) + '***' + (local.length > 2 ? local.slice(-1) : '') + '@' + domain;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 9 && digits.length <= 13) {
    return digits.slice(0, 3) + '-****-' + digits.slice(-4);
  }
  return '***';
}

export function maskLeadAddress(address = '') {
  const words = String(address || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '-';
  return words.slice(0, 2).join(' ') + (words.length > 2 ? ' (상세주소 숨김)' : '');
}

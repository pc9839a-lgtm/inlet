export function load(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function isStorageQuotaError(error) {
  return error?.name === 'QuotaExceededError'
    || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error?.code === 22
    || error?.code === 1014;
}

export function storageErrorMessage(error) {
  if (isStorageQuotaError(error)) return '브라우저 저장 공간이 부족합니다. 큰 이미지나 오래된 임시 초안을 정리하세요.';
  if (error?.name === 'SecurityError') return '브라우저가 로컬 저장 권한을 차단했습니다.';
  return `브라우저 로컬 저장에 실패했습니다. ${String(error?.message || error || '')}`.trim();
}

function payloadBytes(payload) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(payload).length;
  return payload.length;
}

export function save(key, value) {
  let payload = '';
  try {
    payload = JSON.stringify(value);
  } catch (error) {
    console.warn('Save serialization failed:', key, error);
    return { ok: false, key, bytes: 0, reason: 'serialize', error };
  }

  try {
    if (typeof localStorage === 'undefined') throw new Error('localStorage is not available');
    localStorage.setItem(key, payload);
    return { ok: true, key, bytes: payloadBytes(payload) };
  } catch (error) {
    console.warn('Save failed:', key, error);
    return {
      ok: false,
      key,
      bytes: payloadBytes(payload),
      reason: isStorageQuotaError(error) ? 'quota' : 'storage',
      error,
    };
  }
}

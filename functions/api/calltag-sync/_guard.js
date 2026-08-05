import { syncError } from './_shared.js';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export function assertSyncRequestSize(request, maxBytes = DEFAULT_MAX_BYTES) {
  const raw = String(request?.headers?.get?.('Content-Length') || '').trim();
  if (!raw) return;
  const size = Number(raw);
  if (!Number.isFinite(size) || size < 0) {
    throw syncError('요청 크기 정보가 올바르지 않습니다.', 400, 'CALLTAG_SYNC_CONTENT_LENGTH_INVALID');
  }
  if (size > maxBytes) {
    throw syncError('동기화 요청의 크기가 너무 큽니다.', 413, 'CALLTAG_SYNC_REQUEST_TOO_LARGE', {
      maxBytes,
    });
  }
}

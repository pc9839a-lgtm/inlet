import { isClientAiKeyStorageEnabled } from '../config/runtimeConfig.js';

export const AI_STORAGE_NOTICE =
  'API 키는 기본값으로 브라우저에 저장하지 않습니다. 현재 화면에서만 사용하며, 저장을 허용하려면 VITE_INLET_ALLOW_CLIENT_AI_KEY_STORAGE=1을 설정하세요.';

export const AI_MODEL_OPTIONS = [
  ['gpt-4.1', '최고 품질'],
  ['gpt-4.1-mini', '균형'],
  ['gpt-4o-mini', '저비용'],
  ['gpt-4.1-nano', '초고속'],
];

export function normalizeAiSettings(settings = {}) {
  const model = AI_MODEL_OPTIONS.some(([key]) => key === settings.model)
    ? settings.model
    : 'gpt-4.1';
  const apiKey = isClientAiKeyStorageEnabled() ? (settings.apiKey || '') : '';
  const hasSavedKey = isValidOpenAiKey(apiKey);
  const lastTestStatus = settings.lastTestStatus && settings.lastTestStatus !== 'idle'
    ? settings.lastTestStatus
    : hasSavedKey ? 'saved' : 'idle';
  const lastTestMessage = settings.lastTestMessage || (hasSavedKey ? '저장된 API 키를 사용할 수 있습니다.' : '');

  return {
    enabled: !!settings.enabled || hasSavedKey,
    apiKey,
    model,
    lastTestStatus,
    lastTestMessage,
    updatedAt: settings.updatedAt || '',
    draftInput: settings.draftInput || null,
    draftHistory: Array.isArray(settings.draftHistory) ? settings.draftHistory.slice(0, 8) : [],
    lastAppliedDraftId: settings.lastAppliedDraftId || '',
  };
}

export function isValidOpenAiKey(apiKey = '') {
  const key = String(apiKey || '').trim();
  return key.startsWith('sk-') && key.length >= 20;
}

export function maskApiKey(apiKey = '') {
  const key = String(apiKey || '').trim();
  if (!key) return '';
  if (key.length <= 12) return '********';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

export function getAiStatusLabel(status = 'idle') {
  if (status === 'saved') return '사용 가능';
  if (status === 'success') return '연결됨';
  if (status === 'failed') return '확인 필요';
  if (status === 'testing') return '확인 중';
  return '미설정';
}

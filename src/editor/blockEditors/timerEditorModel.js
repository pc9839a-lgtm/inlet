export const TIMER_REPEAT_OPTIONS = [
  ['fixed', '마감일'],
  ['daily24', '매일 반복'],
];

export function timerRepeatMode(settings = {}) {
  return settings.repeatMode || 'fixed';
}

export function timerFloatLabel(settings = {}) {
  return settings.floatLabel || settings.label || '오늘 마감까지';
}

import { T } from './reservationEditorText.js';

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function makeCustomField() {
  return {
    id: uid(),
    label: T.newField,
    type: 'short',
    required: false,
    options: [T.option1, T.option2],
  };
}

export function sameDays(a = [], b = []) {
  return a.length === b.length && a.every((day) => b.includes(day));
}

export function splitOptions(value) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

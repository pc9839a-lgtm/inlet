import { T } from './reservationEditorText.js';

export const customFieldTypes = [
  ['short', T.short],
  ['long', T.long],
  ['select', T.select],
];

export const dayOptions = [
  ['mon', T.mon],
  ['tue', T.tue],
  ['wed', T.wed],
  ['thu', T.thu],
  ['fri', T.fri],
  ['sat', T.sat],
  ['sun', T.sun],
];

export const weekdayDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
export const everydayDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const weekdayPresets = [
  ['weekday', T.weekday],
  ['everyday', T.everyday],
  ['custom', T.custom],
];

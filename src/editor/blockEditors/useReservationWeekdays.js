import { everydayDays, sameDays, weekdayDays } from './reservationEditorModel.js';

export function useReservationWeekdays({ s, set }) {
  const selectedDays = Array.isArray(s.weekdays) ? s.weekdays : [];
  const weekdayMode = s.weekdayMode || (sameDays(selectedDays, weekdayDays) ? 'weekday' : sameDays(selectedDays, everydayDays) ? 'everyday' : 'custom');

  const toggleDay = (day) => {
    set({
      weekdayMode: 'custom',
      weekdays: selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : [...selectedDays, day],
    });
  };

  const setWeekdayPreset = (mode) => {
    if (mode === 'weekday') set({ weekdayMode: mode, weekdays: weekdayDays });
    if (mode === 'everyday') set({ weekdayMode: mode, weekdays: everydayDays });
    if (mode === 'custom') set({ weekdayMode: mode, weekdays: selectedDays.length ? selectedDays : weekdayDays });
  };

  return { selectedDays, weekdayMode, toggleDay, setWeekdayPreset };
}
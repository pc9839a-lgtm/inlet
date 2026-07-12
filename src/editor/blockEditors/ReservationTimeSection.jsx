import { Field } from '../controls.jsx';
import { SegmentedControl } from '../ui/index.js';
import { dayOptions, T, weekdayPresets } from './reservationEditorModel.js';
import { useReservationWeekdays } from './useReservationWeekdays.js';

export default function ReservationTimeSection({ s, set }) {
  const { selectedDays, weekdayMode, toggleDay, setWeekdayPreset } = useReservationWeekdays({ s, set });

  return (
    <>
      <div className="reservation-weekday-panel">
        <SegmentedControl
          label={T.availableDay}
          value={weekdayMode}
          onChange={setWeekdayPreset}
          options={weekdayPresets.map(([value, label]) => ({ value, label }))}
        />
        <div className="reservation-day-detail">
          <span>{T.daySelect}</span>
          <div>
            {dayOptions.map(([key, label]) => (
              <button key={key} type="button" className={selectedDays.includes(key) ? 'active' : ''} onClick={() => toggleDay(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="reservation-time-grid">
        <Field label={T.start} type="time" value={s.start} onChange={(value) => set({ start: value })} />
        <Field label={T.end} type="time" value={s.end} onChange={(value) => set({ end: value })} />
      </div>
      <SegmentedControl
        label={T.interval}
        value={String(s.interval || 30)}
        onChange={(value) => set({ interval: Number(value) })}
        options={[
          { value: '30', label: T.min30 },
          { value: '60', label: T.hour1 },
        ]}
      />
    </>
  );
}
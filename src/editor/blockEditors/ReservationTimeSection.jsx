import { Choice, Field, Step } from '../controls.jsx';
import { dayOptions, T, weekdayPresets } from './reservationEditorModel.js';
import { useReservationWeekdays } from './useReservationWeekdays.js';

export default function ReservationTimeSection({ s, set }) {
  const { selectedDays, weekdayMode, toggleDay, setWeekdayPreset } = useReservationWeekdays({ s, set });

  return (
    <Step title={T.time} icon="2">
      <div className="reservation-weekday-panel">
        <Choice label={T.availableDay} value={weekdayMode} onChange={setWeekdayPreset} options={weekdayPresets} />
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
      <Choice label={T.interval} value={String(s.interval || 30)} onChange={(value) => set({ interval: Number(value) })} options={[["30", T.min30], ["60", T.hour1]]} />
    </Step>
  );
}
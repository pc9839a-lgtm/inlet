const WEEKDAY_OPTIONS = [
  ['mon', '월'],
  ['tue', '화'],
  ['wed', '수'],
  ['thu', '목'],
  ['fri', '금'],
  ['sat', '토'],
  ['sun', '일'],
];

export function Weekdays({ value = [], onToggle }) {
  const selected = Array.isArray(value) ? value : [];

  return (
    <div className="weekday weekday-fixed">
      <span>상담 가능 요일</span>
      <div>
        {WEEKDAY_OPTIONS.map(([key, label]) => (
          <button key={key} type="button" className={selected.includes(key) ? 'active' : ''} onClick={() => onToggle(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
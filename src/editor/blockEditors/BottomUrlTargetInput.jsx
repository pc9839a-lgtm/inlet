export default function BottomUrlTargetInput({ value, onChange, mode = 'url' }) {
  const phone = mode === 'phone';
  return (
    <input
      type={phone ? 'tel' : 'url'}
      aria-label={phone ? '전화번호' : '링크 URL'}
      value={phone ? String(value || '').replace(/^tel:/, '') : (value || '')}
      placeholder={phone ? '010-0000-0000' : 'https://'}
      onChange={(event) => onChange(phone ? `tel:${event.target.value}` : event.target.value)}
    />
  );
}

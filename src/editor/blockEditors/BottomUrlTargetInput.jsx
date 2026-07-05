export default function BottomUrlTargetInput({ value, onChange }) {
  return (
    <input
      value={value || ''}
      placeholder="https://"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

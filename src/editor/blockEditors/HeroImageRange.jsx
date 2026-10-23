import { NumberControl } from '../ui/NumberControl.jsx';

export default function HeroImageRange({ label, unit, value, min, max, onChange }) {
  return <NumberControl className="hero-image-range" valueClassName="hero-image-number" label={label} unit={unit} value={value} min={min} max={max} onChange={onChange} />;
}

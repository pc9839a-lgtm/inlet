import { NumberControl } from '../ui/NumberControl.jsx';

// These values already exist in the block model and renderer; do not create a new spacing schema.
export function WidgetSpacingControls({ s, set, padding = true, defaultMargin = 24 }) {
  return (
    <section className="widget-spacing-controls" aria-label="여백 설정">
      <h3>여백</h3>
      {padding && <NumberControl label="안쪽 상하" unit="px" value={s.paddingY ?? 22} min={0} max={44} presets={[0, 8, 16, 24]} onChange={(paddingY) => set({ paddingY })} />}
      <NumberControl label="바깥 상하" unit="px" value={s.marginY ?? defaultMargin} min={0} max={48} presets={[0, 8, 16, 24]} onChange={(marginY) => set({ marginY })} />
    </section>
  );
}

import { NumberControl } from '../ui/NumberControl.jsx';

// These values already exist in the block model and renderer; do not create a new spacing schema.
export function WidgetSpacingControls({ s, set, padding = true, defaultMargin = 24 }) {
  return (
    <section className="widget-spacing-controls" aria-label="상하 간격">
      <h3>상하 간격</h3>
      {padding && <NumberControl label="내용 안쪽" unit="px" value={s.paddingY ?? 22} min={0} max={44} slider={false} onChange={(paddingY) => set({ paddingY })} />}
      <NumberControl label="블록 사이" unit="px" value={s.marginY ?? defaultMargin} min={0} max={48} slider={false} onChange={(marginY) => set({ marginY })} />
    </section>
  );
}

import { ToggleRow } from '../ui/index.js';

export default function SearchDisplaySection({ s, set }) {
  return (
    <>

      <ToggleRow label="실시간 검색" checked={s.live !== false} onChange={(value) => set({ live: value })} />
    </>
  );
}
import { ToggleRow } from '../ui/index.js';

export default function SearchDisplaySection({ s, set }) {
  return (
    <>

      <ToggleRow label="실시간 검색" description="입력하는 동안 결과를 바로 갱신합니다." checked={s.live !== false} onChange={(value) => set({ live: value })} />
    </>
  );
}
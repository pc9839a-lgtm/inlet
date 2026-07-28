import { Field } from '../controls.jsx';
import { ToggleRow } from '../ui/index.js';

export default function MapTransitSection({ s, set }) {
  const showSubway = typeof s.showSubway === 'boolean' ? s.showSubway : !!String(s.subwayText || '').trim();
  const showBus = typeof s.showBus === 'boolean' ? s.showBus : !!String(s.busText || '').trim();
  const showParking = typeof s.showParking === 'boolean' ? s.showParking : !!String(s.parkingText || '').trim();

  return (
    <>
      <ToggleRow label="지하철 안내" checked={showSubway} onChange={(value) => set({ showSubway: value })} />
      {showSubway && <Field label="지하철 내용" textarea value={s.subwayText || ''} placeholder={'1·4호선 서울역\n출구와 도보 경로를 입력하세요'} onChange={(value) => set({ subwayText: value })} />}
      <ToggleRow label="버스 안내" checked={showBus} onChange={(value) => set({ showBus: value })} />
      {showBus && <Field label="버스 내용" textarea value={s.busText || ''} placeholder={'서울역버스환승센터\n노선과 하차 위치를 입력하세요'} onChange={(value) => set({ busText: value })} />}
      <ToggleRow label="주차 안내" checked={showParking} onChange={(value) => set({ showParking: value })} />
      {showParking && <Field label="주차 내용" textarea value={s.parkingText || ''} placeholder="주차장 위치와 이용 방법을 입력하세요" onChange={(value) => set({ parkingText: value })} />}
      <Field label="티맵 링크" value={s.tmapUrl || ''} placeholder="비워두면 장소명으로 검색" onChange={(value) => set({ tmapUrl: value })} />
      <Field label="네이버 지도 링크" value={s.naverMapUrl || ''} placeholder="비워두면 장소명으로 검색" onChange={(value) => set({ naverMapUrl: value })} />
      <Field label="카카오맵 링크" value={s.kakaoMapUrl || ''} placeholder="비워두면 장소명으로 검색" onChange={(value) => set({ kakaoMapUrl: value })} />
    </>
  );
}

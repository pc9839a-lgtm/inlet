import { Field } from '../controls.jsx';

export default function MapTransitSection({ s, set }) {
  return (
    <>
      <Field label="지하철 안내" textarea value={s.subwayText || ''} placeholder={'7호선 삼산체육관역\n3번 출구 이용'} onChange={(value) => set({ subwayText: value })} />
      <Field label="버스 안내" textarea value={s.busText || ''} placeholder={'삼산체육관 정류소\n24 · 67-1 · 87 · 1200 · 9300'} onChange={(value) => set({ busText: value })} />
      <Field label="주차 안내" textarea value={s.parkingText || ''} onChange={(value) => set({ parkingText: value })} />
      <Field label="티맵 링크" value={s.tmapUrl || ''} placeholder="비워두면 장소명으로 검색" onChange={(value) => set({ tmapUrl: value })} />
      <Field label="네이버 지도 링크" value={s.naverMapUrl || ''} placeholder="비워두면 장소명으로 검색" onChange={(value) => set({ naverMapUrl: value })} />
      <Field label="카카오맵 링크" value={s.kakaoMapUrl || ''} placeholder="비워두면 장소명으로 검색" onChange={(value) => set({ kakaoMapUrl: value })} />
    </>
  );
}

import { Field, Step } from '../controls.jsx';

export default function MapPlaceSection({ s, set }) {
  return (
    <Step title="기본" icon="1" open>
      <Field label="장소명" value={s.placeName || s.title || ''} onChange={(v) => set({ placeName: v, title: v })} />
      <Field label="주소" value={s.address || ''} onChange={(v) => set({ address: v })} />
      <Field label="상세 주소" value={s.detailAddress || ''} onChange={(v) => set({ detailAddress: v })} />
      <Field label="전화번호" value={s.phone || ''} onChange={(v) => set({ phone: v })} />
      <Field label="주차 안내" value={s.parkingText || ''} onChange={(v) => set({ parkingText: v })} />
    </Step>
  );
}
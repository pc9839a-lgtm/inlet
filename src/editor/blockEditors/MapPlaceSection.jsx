import { Field } from '../controls.jsx';

export default function MapPlaceSection({ s, set }) {
  return (
    <>
      <Field label="장소명" value={s.placeName || s.title || ''} onChange={(value) => set({ placeName: value, title: value })} />
      <Field label="주소" value={s.address || ''} onChange={(value) => set({ address: value })} />
      <Field label="상세 주소" value={s.detailAddress || ''} onChange={(value) => set({ detailAddress: value })} />
      <Field label="전화번호" value={s.phone || ''} onChange={(value) => set({ phone: value })} />
      <Field label="주차 안내" value={s.parkingText || ''} onChange={(value) => set({ parkingText: value })} />
    </>
  );
}
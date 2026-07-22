import { Field } from '../controls.jsx';

export default function MapPlaceSection({ s, set }) {
  return (
    <>
      <Field label="상단 문구" value={s.eyebrow || ''} placeholder="LOCATION" onChange={(value) => set({ eyebrow: value })} />
      <Field label="제목" value={s.sectionTitle || ''} placeholder="오시는 길" onChange={(value) => set({ sectionTitle: value })} />
      <Field label="장소명" value={s.placeName || s.title || ''} onChange={(value) => set({ placeName: value, title: value })} />
      <Field label="주소" value={s.address || ''} onChange={(value) => set({ address: value })} />
      <Field label="상세 주소" value={s.detailAddress || ''} onChange={(value) => set({ detailAddress: value })} />
      <Field label="전화번호" value={s.phone || ''} onChange={(value) => set({ phone: value })} />
    </>
  );
}

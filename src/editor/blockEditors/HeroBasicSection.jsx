export default function HeroBasicSection({ s, set, RichField }) {
  return (
    <>
      <RichField
        variant="v2"
        label="제목"
        placeholder="핵심 제목을 입력하세요"
        value={s.title}
        onChange={(value) => set({ title: value })}
      />
      <RichField
        variant="v2"
        label="설명"
        placeholder="설명 문구를 입력하세요"
        value={s.body}
        onChange={(value) => set({ body: value })}
      />
    </>
  );
}
export default function HeroBasicSection({ s, set, RichField }) {
  return (
    <>
      <RichField
        variant="v2"
        label="제목"
        description="방문자가 가장 먼저 읽는 핵심 문구입니다."
        placeholder="핵심 제목을 입력하세요"
        value={s.title}
        onChange={(value) => set({ title: value })}
      />
      <RichField
        variant="v2"
        label="설명"
        description="제목을 보충하는 짧은 안내를 작성합니다."
        placeholder="설명 문구를 입력하세요"
        value={s.body}
        onChange={(value) => set({ body: value })}
      />
    </>
  );
}
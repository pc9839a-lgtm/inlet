import { EditorField } from '../ui/index.js';

export default function ImageCaptionSection({ s, set }) {
  return (
    <EditorField
      label="이미지 설명"
      description="이미지 아래에 표시할 짧은 설명입니다. 비워두면 표시하지 않습니다."
    >
      <input
        value={s.caption || ''}
        placeholder="이미지 설명을 입력하세요"
        onChange={(event) => set({ caption: event.target.value })}
      />
    </EditorField>
  );
}
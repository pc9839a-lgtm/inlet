import { EditorField } from '../ui/index.js';

export default function ImageCaptionSection({ s, set }) {
  return (
    <EditorField
      label="이미지 설명"
    >
      <input
        value={s.caption || ''}
        placeholder="이미지 설명을 입력하세요"
        onChange={(event) => set({ caption: event.target.value })}
      />
    </EditorField>
  );
}

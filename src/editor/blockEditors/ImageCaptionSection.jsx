import { EditorField } from '../ui/index.js';

export default function ImageCaptionSection({ s, set }) {
  return (
    <>
      <EditorField label="목록 구분 이름">
        <input
          type="text"
          aria-label="이미지 목록 구분 이름"
          value={s.editorLabel || ''}
          maxLength={40}
          placeholder="예: 본식 사진, 오시는 길 약도"
          onChange={(event) => set({ editorLabel: event.target.value.slice(0, 40) })}
        />
      </EditorField>
      <EditorField label="이미지 설명">
        <input
          value={s.caption || ''}
          placeholder="이미지 설명을 입력하세요"
          onChange={(event) => set({ caption: event.target.value })}
        />
      </EditorField>
    </>
  );
}

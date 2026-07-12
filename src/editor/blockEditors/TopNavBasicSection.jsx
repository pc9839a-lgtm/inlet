import { ImageInput } from '../controls.jsx';
import { EditorField, SegmentedControl } from '../ui/index.js';

export default function TopNavBasicSection({ s, set, isImageLogo }) {
  return (
    <>
      <SegmentedControl
        label="로고 방식"
        value={s.logoType || 'text'}
        onChange={(value) => set({ logoType: value })}
        options={[
          { value: 'text', label: '텍스트' },
          { value: 'image', label: '이미지' },
        ]}
      />
      {isImageLogo ? (
        <ImageInput label="로고 이미지" value={s.logoImage} onChange={(value) => set({ logoImage: value })} />
      ) : (
        <EditorField label="로고 텍스트" description="페이지 상단에 표시할 짧은 이름입니다.">
          <input value={s.logoText || ''} onChange={(event) => set({ logoText: event.target.value })} />
        </EditorField>
      )}
    </>
  );
}
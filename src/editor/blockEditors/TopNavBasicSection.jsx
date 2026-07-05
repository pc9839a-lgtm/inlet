import { Choice, Field, ImageInput, Step } from '../controls.jsx';

export default function TopNavBasicSection({ s, set, isImageLogo }) {
  return (
    <Step title="기본" icon="1">
      <Choice
        label="타입"
        value={s.logoType || 'text'}
        onChange={(v) => set({ logoType: v })}
        options={[
          ['text', '텍스트'],
          ['image', '이미지'],
        ]}
      />
      {isImageLogo ? (
        <ImageInput label="로고 이미지" value={s.logoImage} onChange={(v) => set({ logoImage: v })} />
      ) : (
        <Field label="로고 텍스트" value={s.logoText} onChange={(v) => set({ logoText: v })} />
      )}
    </Step>
  );
}
import { MousePointer2, PanelsTopLeft } from 'lucide-react';
import { Choice, Color } from '../controls.jsx';
import { EditorSection } from '../ui/index.js';

export default function FormDesignSection({ s, set }) {
  return (
    <>
      <EditorSection id="form-layout" title="폼 모양" icon={PanelsTopLeft} defaultOpen>
        <Choice label="폼 형태" value={s.style || 'card'} onChange={(value) => set({ style: value })} options={[[ 'card', '카드' ], [ 'line', '라인' ], [ 'soft', '소프트' ], [ 'minimal', '미니멀' ]]} />
        <Choice label="입력칸" value={s.inputStyle || 'round'} onChange={(value) => set({ inputStyle: value })} options={[[ 'round', '라운드' ], [ 'box', '박스' ], [ 'underline', '밑줄' ]]} />
        <Choice label="간격" value={s.spacing || 'normal'} onChange={(value) => set({ spacing: value })} options={[[ 'compact', '좁게' ], [ 'normal', '보통' ], [ 'wide', '넓게' ]]} />
        <Choice label="모서리" value={s.radiusStyle || 'round'} onChange={(value) => set({ radiusStyle: value })} options={[[ 'square', '각진' ], [ 'round', '둥근' ], [ 'pill', '캡슐' ]]} />
        <Choice label="정렬" value={s.textAlign || 'left'} onChange={(value) => set({ textAlign: value })} options={[[ 'left', '왼쪽' ], [ 'center', '가운데' ], [ 'right', '오른쪽' ]]} />
      </EditorSection>

      <EditorSection id="form-button" title="제출 버튼" icon={MousePointer2}>
        <Choice label="버튼 모양" value={s.buttonStyle || 'solid'} onChange={(value) => set({ buttonStyle: value })} options={[[ 'solid', '채움' ], [ 'round', '둥근' ], [ 'line', '라인' ]]} />
        <Choice label="마우스 효과" value={s.buttonHover || 'fill'} onChange={(value) => set({ buttonHover: value })} options={[[ 'fill', '채움' ], [ 'slide', '슬라이드' ], [ 'zoom', '확대' ]]} />
        <Choice label="버튼 색상" value={s.buttonColorMode || 'theme'} onChange={(value) => set({ buttonColorMode: value })} options={[[ 'theme', '테마' ], [ 'custom', '직접 지정' ]]} />
        {(s.buttonColorMode || 'theme') === 'custom' && <Color label="버튼 배경" value={s.buttonColor || '#111827'} onChange={(value) => set({ buttonColor: value })} />}
        <Color label="버튼 글자" value={s.buttonTextColor || '#ffffff'} onChange={(value) => set({ buttonTextColor: value })} />
        <Choice label="마우스 색상" value={s.buttonHoverColorMode || 'theme'} onChange={(value) => set({ buttonHoverColorMode: value })} options={[[ 'theme', '테마' ], [ 'custom', '직접 지정' ]]} />
        {(s.buttonHoverColorMode || 'theme') === 'custom' && <Color label="마우스 배경" value={s.buttonHoverColor || s.buttonColor || '#2563eb'} onChange={(value) => set({ buttonHoverColor: value })} />}
      </EditorSection>
    </>
  );
}
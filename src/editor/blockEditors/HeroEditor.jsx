import { FileText, Image as ImageIcon } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import HeroBasicSection from './HeroBasicSection.jsx';
import HeroImageSection from './HeroImageSection.jsx';

export default function HeroEditor({ s, set, Range, RichField }) {
  return (
    <>
      <EditorSection
        id="content"
        title="내용"
        description="첫 화면에서 전달할 핵심 문구를 입력합니다."
        icon={FileText}
        defaultOpen
      >
        <HeroBasicSection s={s} set={set} RichField={RichField} />
      </EditorSection>
      <EditorSection
        id="design"
        title="이미지 디자인"
        description="대표 이미지의 배치와 높이를 설정합니다."
        icon={ImageIcon}
        defaultOpen
      >
        <HeroImageSection s={s} set={set} Range={Range} />
      </EditorSection>
    </>
  );
}
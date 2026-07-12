import { Building2, FileText, Phone } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import FooterBusinessSection from './FooterBusinessSection.jsx';
import FooterContactSection from './FooterContactSection.jsx';
import FooterLegalSection from './FooterLegalSection.jsx';

export default function FooterEditor({ s, set }) {
  return (
    <>
      <EditorSection id="content" title="사업자 정보" description="푸터에 표시할 기본 사업자 정보를 입력합니다." icon={Building2} defaultOpen>
        <FooterBusinessSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="contact" title="연락처" description="고객이 확인할 연락처와 주소를 입력합니다." icon={Phone}>
        <FooterContactSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="behavior" title="법적 문서" description="개인정보처리방침과 이용약관 주소를 연결합니다." icon={FileText}>
        <FooterLegalSection s={s} set={set} />
      </EditorSection>
    </>
  );
}
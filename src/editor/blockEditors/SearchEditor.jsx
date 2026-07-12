import { FileText, SlidersHorizontal } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import SearchBasicSection from './SearchBasicSection.jsx';
import SearchDisplaySection from './SearchDisplaySection.jsx';

export default function SearchEditor({ s, set }) {
  return (
    <>
      <EditorSection id="content" title="검색 안내" description="검색창에 표시할 제목과 안내를 입력합니다." icon={FileText} defaultOpen>
        <SearchBasicSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="design" title="표시 방식" description="검색창 형태와 검색 시점을 설정합니다." icon={SlidersHorizontal}>
        <SearchDisplaySection s={s} set={set} />
      </EditorSection>
    </>
  );
}
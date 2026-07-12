import { Database, SlidersHorizontal } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import ActivityBasicSection from './ActivityBasicSection.jsx';
import ActivityDisplaySection from './ActivityDisplaySection.jsx';

export default function ActivityEditor({ s, set }) {
  const dataSource = s.dataSource || 'sample';
  const mode = s.mode || 'feed';

  return (
    <>
      <EditorSection id="content" title="접수 데이터" description="표시할 접수 데이터와 제목을 설정합니다." icon={Database} defaultOpen>
        <ActivityBasicSection s={s} set={set} dataSource={dataSource} />
      </EditorSection>
      <EditorSection id="design" title="표시 방식" description="접수 목록 또는 누적 숫자로 표시합니다." icon={SlidersHorizontal}>
        <ActivityDisplaySection s={s} set={set} dataSource={dataSource} mode={mode} />
      </EditorSection>
    </>
  );
}
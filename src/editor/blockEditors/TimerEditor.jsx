import { FileText, MousePointerClick } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import TimerBasicSection from './TimerBasicSection.jsx';
import TimerCtaTargetSection from './TimerCtaTargetSection.jsx';
import TimerFloatingCtaSection from './TimerFloatingCtaSection.jsx';

export default function TimerEditor({ s, set, page, TargetControl }) {
  return (
    <>
      <EditorSection id="content" title="타이머" description="마감 문구와 반복 방식을 설정합니다." icon={FileText} defaultOpen>
        <TimerBasicSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="behavior" title="CTA 동작" description="타이머와 함께 표시할 버튼과 이동 위치를 설정합니다." icon={MousePointerClick}>
        <TimerFloatingCtaSection s={s} set={set} />
        <TimerCtaTargetSection s={s} set={set} page={page} TargetControl={TargetControl} />
      </EditorSection>
    </>
  );
}
import { CalendarDays } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import ScheduleBasicSection from './ScheduleBasicSection.jsx';

export default function ScheduleEditor({ s, set }) {
  return (
    <EditorSection id="content" title="일정" description="날짜와 장소, 안내 내용을 입력합니다." icon={CalendarDays} defaultOpen>
      <ScheduleBasicSection s={s} set={set} />
    </EditorSection>
  );
}
import { CalendarDays } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import ScheduleBasicSection from './ScheduleBasicSection.jsx';

export default function ScheduleEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[{
        id: 'content',
        label: '내용',
        content: <ScheduleBasicSection s={s} set={set} />,
      }]}
    />
  );
}
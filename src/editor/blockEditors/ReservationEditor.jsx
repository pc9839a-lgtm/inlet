import { CalendarClock, FileText, ListChecks } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import ReservationBasicSection from './ReservationBasicSection.jsx';
import ReservationFieldsStep from './ReservationFieldsStep.jsx';
import ReservationTimeSection from './ReservationTimeSection.jsx';

export default function ReservationEditor({ s, set }) {
  return (
    <>
      <EditorSection id="content" title="내용" description="예약 화면의 제목과 안내 문구를 입력합니다." icon={FileText} defaultOpen>
        <ReservationBasicSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="behavior" title="예약 가능 시간" description="예약을 받을 요일과 시간 간격을 설정합니다." icon={CalendarClock} defaultOpen>
        <ReservationTimeSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="items" title="입력 항목" description="예약자에게 받을 기본 정보와 추가 질문을 설정합니다." icon={ListChecks}>
        <ReservationFieldsStep s={s} set={set} />
      </EditorSection>
    </>
  );
}
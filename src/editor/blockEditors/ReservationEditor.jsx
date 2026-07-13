import { EditorTabs } from '../ui/index.js';
import ReservationBasicSection from './ReservationBasicSection.jsx';
import ReservationFieldsStep from './ReservationFieldsStep.jsx';
import ReservationTimeSection from './ReservationTimeSection.jsx';

export default function ReservationEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: <ReservationBasicSection s={s} set={set} />,
        },
        {
          id: 'schedule',
          label: '예약 시간',
          content: <ReservationTimeSection s={s} set={set} />,
        },
        {
          id: 'items',
          label: '입력 항목',
          content: <ReservationFieldsStep s={s} set={set} />,
        },
      ]}
    />
  );
}

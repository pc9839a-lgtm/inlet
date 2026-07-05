import { EditorStack } from '../controls.jsx';
import ReservationBasicSection from './ReservationBasicSection.jsx';
import ReservationFieldsStep from './ReservationFieldsStep.jsx';
import ReservationTimeSection from './ReservationTimeSection.jsx';

export default function ReservationEditor({ s, set }) {
  return (
    <EditorStack>
      <ReservationBasicSection s={s} set={set} />
      <ReservationTimeSection s={s} set={set} />
      <ReservationFieldsStep s={s} set={set} />
    </EditorStack>
  );
}
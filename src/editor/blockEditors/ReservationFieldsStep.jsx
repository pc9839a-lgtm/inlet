import { Step } from '../controls.jsx';
import { ReservationFieldsSection } from './ReservationFieldsSection.jsx';
import { T } from './reservationEditorModel.js';

export default function ReservationFieldsStep({ s, set }) {
  return (
    <Step title={T.fields} icon="3">
      <ReservationFieldsSection s={s} set={set} />
    </Step>
  );
}
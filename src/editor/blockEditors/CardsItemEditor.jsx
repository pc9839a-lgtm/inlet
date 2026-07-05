import { Danger, MiniDetail } from '../controls.jsx';
import CardsItemFields from './CardsItemFields.jsx';

export default function CardsItemEditor({ item, index, onChange, onRemove }) {
  return (
    <MiniDetail icon={index + 1} title={item.title || `카드 ${index + 1}`}>
      <CardsItemFields item={item} onChange={onChange} />
      <Danger onClick={onRemove} />
    </MiniDetail>
  );
}
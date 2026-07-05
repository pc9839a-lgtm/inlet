import { MiniDetail } from '../controls.jsx';
import FaqItemFields from './FaqItemFields.jsx';

export default function FaqItemEditor({ item, index, onChange, onRemove }) {
  return (
    <MiniDetail icon={index + 1} title={item.q || `질문 ${index + 1}`}>
      <FaqItemFields item={item} onChange={onChange} onRemove={onRemove} />
    </MiniDetail>
  );
}
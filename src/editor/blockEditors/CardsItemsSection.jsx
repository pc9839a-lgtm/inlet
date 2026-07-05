import { AddButton, Step } from '../controls.jsx';
import CardsItemsList from './CardsItemsList.jsx';

export default function CardsItemsSection({ items, onChangeItem, onRemoveItem, onAddItem }) {
  return (
    <Step title="카드" icon="2" open>
      <CardsItemsList items={items} onChangeItem={onChangeItem} onRemoveItem={onRemoveItem} />
      <AddButton onClick={onAddItem} />
    </Step>
  );
}
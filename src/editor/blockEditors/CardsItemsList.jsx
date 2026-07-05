import CardsItemEditor from './CardsItemEditor.jsx';

export default function CardsItemsList({ items, onChangeItem, onRemoveItem }) {
  return (
    <>
      {items.map((item, index) => (
        <CardsItemEditor
          key={item.id}
          item={item}
          index={index}
          onChange={(patch) => onChangeItem(item.id, patch)}
          onRemove={() => onRemoveItem(item.id)}
        />
      ))}
    </>
  );
}
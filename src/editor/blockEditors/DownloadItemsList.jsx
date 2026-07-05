import DownloadItemCard from './DownloadItemCard.jsx';

export default function DownloadItemsList({ items, page, authUser, updateItem, removeItem }) {
  return (
    <div className="download-simple-list">
      {items.map((item, index) => (
        <DownloadItemCard
          key={item.id}
          item={item}
          index={index}
          canRemove={items.length > 1}
          page={page}
          authUser={authUser}
          onChange={(patch) => updateItem(item.id, patch)}
          onRemove={() => removeItem(item.id)}
        />
      ))}
    </div>
  );
}
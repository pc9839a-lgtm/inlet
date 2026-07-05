import { AddButton, Step } from '../controls.jsx';
import DownloadItemsList from './DownloadItemsList.jsx';

export default function DownloadItemsSection({ items, page, authUser, updateItem, removeItem, addItem }) {
  return (
    <Step title="파일 공유" icon="1" open>
      <DownloadItemsList
        items={items}
        page={page}
        authUser={authUser}
        updateItem={updateItem}
        removeItem={removeItem}
      />
      <AddButton onClick={addItem} />
    </Step>
  );
}
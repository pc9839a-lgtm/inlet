import { EditorList, EditorTabs } from '../ui/index.js';
import DownloadFileUploadRow from './DownloadFileUploadRow.jsx';
import DownloadItemFields from './DownloadItemFields.jsx';
import { useDownloadItems } from './useDownloadItems.js';

export default function DownloadEditor({ s, set, page, authUser }) {
  const { items, updateItem, removeItem, addItem } = useDownloadItems(s, set);

  return (
    <EditorTabs
      tabs={[
        {
          id: 'items',
          label: '파일',
          content: (
            <EditorList
              items={items}
              getTitle={(item, index) => item.title || item.fileName || `파일 ${index + 1}`}
              getIcon={(_, index) => index + 1}
              renderItem={(item) => (
                <>
                  <DownloadItemFields item={item} onChange={(patch) => updateItem(item.id, patch)} />
                  <DownloadFileUploadRow item={item} page={page} authUser={authUser} onChange={(patch) => updateItem(item.id, patch)} />
                </>
              )}
              onRemove={(item) => removeItem(item.id)}
              canRemove={() => items.length > 1}
              onAdd={addItem}
              addLabel="파일 추가"
              emptyText="파일이 없습니다."
            />
          ),
        },
      ]}
    />
  );
}

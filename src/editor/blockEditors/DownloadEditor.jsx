import { Download } from 'lucide-react';
import { EditorList, EditorSection } from '../ui/index.js';
import DownloadFileUploadRow from './DownloadFileUploadRow.jsx';
import DownloadItemFields from './DownloadItemFields.jsx';
import { useDownloadItems } from './useDownloadItems.js';

export default function DownloadEditor({ s, set, page, authUser }) {
  const { items, updateItem, removeItem, addItem } = useDownloadItems(s, set);

  return (
    <EditorSection
      id="items"
      title="다운로드 파일"
      description="방문자에게 제공할 파일과 안내 문구를 관리합니다."
      icon={Download}
      defaultOpen
    >
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
        emptyText="공유할 파일을 추가해 주세요."
      />
    </EditorSection>
  );
}
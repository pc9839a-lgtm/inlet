import DownloadFileUploadRow from './DownloadFileUploadRow.jsx';
import DownloadItemFields from './DownloadItemFields.jsx';
import DownloadItemHeader from './DownloadItemHeader.jsx';

export default function DownloadItemCard({ item, index, canRemove, page, authUser, onChange, onRemove }) {
  return (
    <div className="download-simple-card">
      <DownloadItemHeader index={index} canRemove={canRemove} onRemove={onRemove} />
      <DownloadItemFields item={item} onChange={onChange} />
      <DownloadFileUploadRow item={item} page={page} authUser={authUser} onChange={onChange} />
    </div>
  );
}
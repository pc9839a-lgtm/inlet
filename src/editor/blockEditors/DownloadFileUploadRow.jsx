import DownloadFileUploadControl from './DownloadFileUploadControl.jsx';
import { useDownloadFileUpload } from './useDownloadFileUpload.js';

export default function DownloadFileUploadRow({ item, page, authUser, onChange }) {
  const upload = useDownloadFileUpload({ item, page, authUser, onChange });

  return (
    <DownloadFileUploadControl
      item={item}
      inputRef={upload.inputRef}
      uploading={upload.uploading}
      onPick={upload.pick}
      onOpen={upload.openPicker}
      onClear={upload.clearFile}
    />
  );
}
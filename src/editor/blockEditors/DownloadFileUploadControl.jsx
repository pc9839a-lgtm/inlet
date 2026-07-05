import { DOWNLOAD_FILE_ACCEPT } from './downloadEditorModel.js';

export default function DownloadFileUploadControl({ item, inputRef, uploading, onPick, onOpen, onClear }) {
  return (
    <div className="download-upload-row">
      <label>파일 업로드 <span>*</span></label>
      <div className="download-upload-control">
        <button type="button" disabled={uploading} onClick={onOpen}>
          {item.fileName || (uploading ? '업로드 중' : '파일 선택')}
        </button>
        {item.sizeLabel && <em>{item.sizeLabel}</em>}
        {item.fileUrl && <button type="button" className="download-remove-file" onClick={onClear}>삭제</button>}
      </div>
      <input ref={inputRef} type="file" accept={DOWNLOAD_FILE_ACCEPT} hidden disabled={uploading} onChange={(event) => onPick(event.target.files?.[0])} />
    </div>
  );
}
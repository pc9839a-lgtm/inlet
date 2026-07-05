import LinkThumbActions from './LinkThumbActions.jsx';
import LinkThumbPreview from './LinkThumbPreview.jsx';
import LinkThumbStorageNotice from './LinkThumbStorageNotice.jsx';
import { useLinkThumbPicker } from './useLinkThumbPicker.js';

export default function LinkThumbPicker({ item, onChange }) {
  const { loading, uploadRef, thumbStorage, autoThumb, uploadThumb } = useLinkThumbPicker(item, onChange);

  return (
    <div className="thumb-simple-row thumb-simple-row-v2">
      <LinkThumbPreview thumb={item.thumb} />
      <LinkThumbActions
        hasThumb={Boolean(item.thumb)}
        loading={loading}
        onAuto={autoThumb}
        onUpload={() => uploadRef.current?.click()}
        onDelete={() => onChange({ thumb: '' })}
      />
      <LinkThumbStorageNotice storage={thumbStorage} onClear={() => onChange({ thumb: '' })} />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => uploadThumb(event.target.files?.[0])}
      />
    </div>
  );
}
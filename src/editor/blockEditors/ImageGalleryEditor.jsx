import { ImageIcon } from 'lucide-react';
import { ImageInput } from '../controls.jsx';
import { EditorList } from '../ui/index.js';
import { GalleryMultiUpload } from './GalleryMultiUpload.jsx';

export default function ImageGalleryEditor({ gallery, set, updateGallery, removeGallery }) {
  const filledGallery = gallery.filter(Boolean);
  const items = gallery.map((src, index) => ({
    id: `gallery-image-${index}`,
    src,
    index,
  }));

  return (
    <>
      <GalleryMultiUpload
        count={filledGallery.length}
        max={4}
        onAdd={(images) => set({ gallery: [...filledGallery, ...images].slice(0, 4) })}
      />
      <EditorList
        items={items}
        getIcon={() => <ImageIcon size={16} aria-hidden="true" />}
        getTitle={(item) => `이미지 ${item.index + 1}`}
        getBadge={(item) => (item.src ? '등록됨' : '비어 있음')}
        renderItem={(item) => (
          <ImageInput
            label="이미지"
            value={item.src}
            onChange={(value) => updateGallery(item.index, value)}
          />
        )}
        onAdd={gallery.length < 4 ? () => set({ gallery: [...gallery, ''] }) : undefined}
        addLabel="이미지 추가"
        onRemove={(item) => removeGallery(item.index)}
      />
    </>
  );
}

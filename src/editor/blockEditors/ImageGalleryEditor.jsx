import { AddButton, Danger, ImageInput } from '../controls.jsx';
import { GalleryMultiUpload } from './GalleryMultiUpload.jsx';

export default function ImageGalleryEditor({ gallery, set, updateGallery, removeGallery }) {
  const filledGallery = gallery.filter(Boolean);

  return (
    <>
      <GalleryMultiUpload
        count={filledGallery.length}
        max={10}
        onAdd={(images) => set({ gallery: [...filledGallery, ...images].slice(0, 10) })}
      />
      <div className="gallery-edit">
        {gallery.map((img, index) => (
          <div key={index}>
            <ImageInput label={`${index + 1}`} value={img} onChange={(value) => updateGallery(index, value)} />
            <Danger onClick={() => removeGallery(index)} />
          </div>
        ))}
      </div>
      {gallery.length < 10 && <AddButton onClick={() => set({ gallery: [...gallery, ''] })} />}
    </>
  );
}
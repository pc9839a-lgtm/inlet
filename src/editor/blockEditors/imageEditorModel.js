export const DEFAULT_IMAGE_CROP = {
  imageDisplay: 'original',
  imageHeightPx: 260,
  imageX: 50,
  imageY: 50,
};

export function getImageGallery(s = {}) {
  return Array.isArray(s.gallery) ? s.gallery : [];
}

export function getImageDisplay(s = {}) {
  return s.imageDisplay || 'original';
}

export function getImageEditSource(s = {}, gallery = getImageGallery(s)) {
  return s.mode === 'gallery' ? gallery.find(Boolean) : s.image;
}

export function getImageStorageEntries(s = {}, gallery = getImageGallery(s)) {
  return s.mode === 'gallery' ? gallery : [s.image];
}

export function resetImageCrop() {
  return { ...DEFAULT_IMAGE_CROP };
}

export function updateGalleryImage(gallery, index, value) {
  return gallery.map((item, itemIndex) => (itemIndex === index ? value : item));
}

export function removeGalleryImagePatch(gallery, index) {
  const next = gallery.filter((_, itemIndex) => itemIndex !== index);
  return next.some(Boolean) ? { gallery: next } : { gallery: next, ...resetImageCrop() };
}

export function updateSingleImagePatch(value) {
  return value ? { image: value, ...resetImageCrop() } : { image: '', ...resetImageCrop() };
}

export function changeImageDisplayPatch(s = {}, value) {
  if (value === 'original') return { imageDisplay: 'original' };

  return {
    imageDisplay: 'fill',
    imageHeightPx: Number(s.imageHeightPx || 260),
    imageX: Number(s.imageX ?? 50),
    imageY: Number(s.imageY ?? 50),
  };
}
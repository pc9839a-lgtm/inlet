import { useState } from 'react';
import { storedImagesSummary } from '../controls.jsx';
import {
  changeImageDisplayPatch,
  getImageDisplay,
  getImageEditSource,
  getImageGallery,
  getImageStorageEntries,
  removeGalleryImagePatch,
  updateGalleryImage,
  updateSingleImagePatch,
} from './imageEditorModel.js';

export default function useImageEditorState({ s, set }) {
  const gallery = getImageGallery(s);
  const display = getImageDisplay(s);
  const editSrc = getImageEditSource(s, gallery);
  const storageSummary = storedImagesSummary(getImageStorageEntries(s, gallery));
  const [cropOpen, setCropOpen] = useState(false);

  const updateGallery = (index, value) => {
    set({ gallery: updateGalleryImage(gallery, index, value) });
  };

  const removeGallery = (index) => {
    set(removeGalleryImagePatch(gallery, index));
  };

  const updateSingleImage = (value) => {
    set(updateSingleImagePatch(value));
  };

  const changeDisplay = (value) => {
    set(changeImageDisplayPatch(s, value));
  };

  return {
    gallery,
    display,
    editSrc,
    storageSummary,
    cropOpen,
    setCropOpen,
    updateGallery,
    removeGallery,
    updateSingleImage,
    changeDisplay,
  };
}
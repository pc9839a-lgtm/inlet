import { EditorTabs } from '../ui/index.js';
import ImageBasicSection from './ImageBasicSection.jsx';
import ImageCaptionSection from './ImageCaptionSection.jsx';
import ImageDisplayControls from './ImageDisplayControls.jsx';
import ImageGalleryDisplaySection from './ImageGalleryDisplaySection.jsx';
import useImageEditorState from './useImageEditorState.js';

export default function ImageEditor({ s, set, block }) {
  const imageState = useImageEditorState({ s, set });

  return (
    <EditorTabs
      tabs={[
        {
          id: 'image',
          label: '이미지',
          content: (
            <>
              <ImageBasicSection
                s={s}
                set={set}
                gallery={imageState.gallery}
                storageSummary={imageState.storageSummary}
                updateGallery={imageState.updateGallery}
                removeGallery={imageState.removeGallery}
                updateSingleImage={imageState.updateSingleImage}
              />
              <ImageCaptionSection s={s} set={set} />
            </>
          ),
        },
        {
          id: 'layout',
          label: '레이아웃',
          content: (
            <>
              <ImageDisplayControls
                display={imageState.display}
                s={s}
                set={set}
                editSrc={imageState.editSrc}
                blockId={block?.id}
                cropOpen={imageState.cropOpen}
                setCropOpen={imageState.setCropOpen}
                changeDisplay={imageState.changeDisplay}
              />
              <ImageGalleryDisplaySection s={s} set={set} />
            </>
          ),
        },
      ]}
    />
  );
}

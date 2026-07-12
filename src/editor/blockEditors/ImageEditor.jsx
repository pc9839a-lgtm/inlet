import { Image as ImageIcon, SlidersHorizontal } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import ImageBasicSection from './ImageBasicSection.jsx';
import ImageCaptionSection from './ImageCaptionSection.jsx';
import ImageDisplayControls from './ImageDisplayControls.jsx';
import ImageGalleryDisplaySection from './ImageGalleryDisplaySection.jsx';
import useImageEditorState from './useImageEditorState.js';

export default function ImageEditor({ s, set, block }) {
  const imageState = useImageEditorState({ s, set });

  return (
    <>
      <EditorSection
        id="content"
        title="이미지"
        description="표시할 이미지와 설명을 설정합니다."
        icon={ImageIcon}
        defaultOpen
      >
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
      </EditorSection>
      <EditorSection
        id="design"
        title="표시 방식"
        description="이미지 비율과 갤러리 전환 방식을 설정합니다."
        icon={SlidersHorizontal}
      >
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
      </EditorSection>
    </>
  );
}
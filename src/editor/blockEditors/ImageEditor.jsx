import { EditorStack } from '../controls.jsx';
import ImageBasicSection from './ImageBasicSection.jsx';
import ImageCaptionSection from './ImageCaptionSection.jsx';
import ImageGalleryDisplaySection from './ImageGalleryDisplaySection.jsx';
import useImageEditorState from './useImageEditorState.js';

export default function ImageEditor({ s, set, block }) {
  const imageState = useImageEditorState({ s, set });

  return (
    <EditorStack>
      <ImageBasicSection
        s={s}
        set={set}
        block={block}
        {...imageState}
      />
      <ImageGalleryDisplaySection s={s} set={set} />
      <ImageCaptionSection s={s} set={set} />
    </EditorStack>
  );
}
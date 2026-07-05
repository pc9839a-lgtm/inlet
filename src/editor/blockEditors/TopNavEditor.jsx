import { EditorStack } from '../controls.jsx';
import TopNavBasicSection from './TopNavBasicSection.jsx';
import TopNavMenuListSection from './TopNavMenuListSection.jsx';
import { useTopNavMenuController } from './useTopNavMenuController.js';

export default function TopNavEditor({ s, set, page, TargetControl }) {
  const menuController = useTopNavMenuController(s, set);
  const isImageLogo = s.logoType === 'image';

  return (
    <EditorStack>
      <TopNavBasicSection s={s} set={set} isImageLogo={isImageLogo} />
      <TopNavMenuListSection page={page} TargetControl={TargetControl} {...menuController} />
    </EditorStack>
  );
}
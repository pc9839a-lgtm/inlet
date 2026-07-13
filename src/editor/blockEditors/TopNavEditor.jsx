import { EditorTabs } from '../ui/index.js';
import TopNavBasicSection from './TopNavBasicSection.jsx';
import TopNavMenuListSection from './TopNavMenuListSection.jsx';
import { useTopNavMenuController } from './useTopNavMenuController.js';

export default function TopNavEditor({ s, set, page, TargetControl }) {
  const menuController = useTopNavMenuController(s, set);
  const isImageLogo = s.logoType === 'image';

  return (
    <EditorTabs
      tabs={[
        {
          id: 'logo',
          label: '로고',
          content: <TopNavBasicSection s={s} set={set} isImageLogo={isImageLogo} />,
        },
        {
          id: 'items',
          label: '메뉴',
          content: <TopNavMenuListSection page={page} TargetControl={TargetControl} {...menuController} />,
        },
      ]}
    />
  );
}

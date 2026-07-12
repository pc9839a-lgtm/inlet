import { Image as ImageIcon, Menu } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import TopNavBasicSection from './TopNavBasicSection.jsx';
import TopNavMenuListSection from './TopNavMenuListSection.jsx';
import { useTopNavMenuController } from './useTopNavMenuController.js';

export default function TopNavEditor({ s, set, page, TargetControl }) {
  const menuController = useTopNavMenuController(s, set);
  const isImageLogo = s.logoType === 'image';

  return (
    <>
      <EditorSection id="content" title="로고" description="상단에 표시할 페이지 이름이나 로고를 설정합니다." icon={ImageIcon} defaultOpen>
        <TopNavBasicSection s={s} set={set} isImageLogo={isImageLogo} />
      </EditorSection>
      <EditorSection id="items" title="메뉴 목록" description="상단 메뉴 이름과 이동할 위치를 설정합니다." icon={Menu} defaultOpen>
        <TopNavMenuListSection page={page} TargetControl={TargetControl} {...menuController} />
      </EditorSection>
    </>
  );
}
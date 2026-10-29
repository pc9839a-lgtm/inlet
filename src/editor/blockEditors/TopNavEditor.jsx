import { ChevronDown } from 'lucide-react';
import TopNavBasicSection from './TopNavBasicSection.jsx';
import TopNavMenuListSection from './TopNavMenuListSection.jsx';
import { useTopNavMenuController } from './useTopNavMenuController.js';
import { TopNavStylePanel } from './WidgetStylePanels.jsx';

export default function TopNavEditor({ s, set, page, TargetControl }) {
  const menuController = useTopNavMenuController(s, set);
  const isImageLogo = s.logoType === 'image';

  return (
    <div className="topnav-editor-flow">
      <section className="topnav-editor-logo" aria-label="로고 편집">
        <TopNavBasicSection s={s} set={set} isImageLogo={isImageLogo} />
      </section>
      <section className="topnav-editor-menus" aria-label="메뉴 편집">
        <h3>메뉴</h3>
        <TopNavMenuListSection page={page} TargetControl={TargetControl} {...menuController} />
      </section>
      <details className="topnav-editor-design">
        <summary>
          <strong>디자인</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="topnav-editor-design-controls">
          <TopNavStylePanel s={s} set={set} />
        </div>
      </details>
    </div>
  );
}

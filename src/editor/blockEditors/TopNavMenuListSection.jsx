import { Step } from '../controls.jsx';
import TopNavMenuCountControl from './TopNavMenuCountControl.jsx';
import TopNavMenuItemsList from './TopNavMenuItemsList.jsx';

export default function TopNavMenuListSection({
  menus,
  page,
  TargetControl,
  openMenuId,
  dragId,
  dragOverId,
  setMenuCount,
  setOpenMenuId,
  setDragId,
  setDragOverId,
  updateMenu,
  removeMenu,
  moveMenu,
}) {
  return (
    <Step title="메뉴" icon="2">
      <TopNavMenuCountControl count={menus.length || 1} onChange={setMenuCount} />
      <TopNavMenuItemsList
        menus={menus}
        page={page}
        TargetControl={TargetControl}
        openMenuId={openMenuId}
        dragId={dragId}
        dragOverId={dragOverId}
        setOpenMenuId={setOpenMenuId}
        setDragId={setDragId}
        setDragOverId={setDragOverId}
        updateMenu={updateMenu}
        removeMenu={removeMenu}
        moveMenu={moveMenu}
      />
    </Step>
  );
}
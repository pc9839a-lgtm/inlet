import { TopNavMenuItemEditor } from './TopNavMenuItemEditor.jsx';

export default function TopNavMenuItemsList({
  menus,
  page,
  TargetControl,
  openMenuId,
  dragId,
  dragOverId,
  setOpenMenuId,
  setDragId,
  setDragOverId,
  updateMenu,
  removeMenu,
  moveMenu,
}) {
  return (
    <div className="topnav-menu-list">
      {menus.map((menu, index) => (
        <TopNavMenuItemEditor
          key={menu.id}
          menu={menu}
          index={index}
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
      ))}
    </div>
  );
}
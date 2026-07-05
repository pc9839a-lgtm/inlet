import TopNavMenuItemFields from './TopNavMenuItemFields.jsx';
import TopNavMenuItemSummary from './TopNavMenuItemSummary.jsx';

export function TopNavMenuItemEditor({
  menu,
  index,
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
  const open = openMenuId === menu.id;

  return (
    <details
      className={`topnav-menu-card ${dragId === menu.id ? 'dragging' : ''} ${dragOverId === menu.id ? 'drag-over' : ''}`}
      open={open}
      draggable
      onToggle={(event) => {
        if (event.currentTarget.open) setOpenMenuId(menu.id);
        else if (open) setOpenMenuId('');
      }}
      onDragStart={(event) => {
        setDragId(menu.id);
        event.dataTransfer.setData('text/plain', menu.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOverId(menu.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        moveMenu(menu.id);
        setDragId('');
        setDragOverId('');
      }}
      onDragEnd={() => {
        setDragId('');
        setDragOverId('');
      }}
    >
      <TopNavMenuItemSummary
        menu={menu}
        index={index}
        menus={menus}
        open={open}
        onRemove={() => removeMenu(menu.id)}
      />
      <TopNavMenuItemFields
        menu={menu}
        page={page}
        TargetControl={TargetControl}
        onChange={(patch) => updateMenu(menu.id, patch)}
      />
    </details>
  );
}
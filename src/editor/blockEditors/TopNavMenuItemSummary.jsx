export default function TopNavMenuItemSummary({ menu, index, menus, open, onRemove }) {
  return (
    <summary>
      <span className="topnav-menu-drag" title="드래그해서 순서 변경" />
      <strong>{index + 1}. {menu.label || '메뉴'}</strong>
      <span className="topnav-menu-toggle">{open ? '닫기' : '설정'}</span>
      <button
        type="button"
        disabled={menus.length <= 1}
        onClick={(event) => {
          event.preventDefault();
          onRemove();
        }}
      >
        삭제
      </button>
    </summary>
  );
}
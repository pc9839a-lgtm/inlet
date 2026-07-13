import { ChevronDown, GripVertical, Trash2 } from 'lucide-react';

const MENU_LABEL = '\uBA54\uB274';
const DELETE_LABEL = '\uC0AD\uC81C';
const REORDER_LABEL = '\uB4DC\uB798\uADF8\uD574\uC11C \uC21C\uC11C \uBCC0\uACBD';

export default function TopNavMenuItemSummary({ menu, index, menus, open, onRemove }) {
  const title = menu.label || MENU_LABEL;

  return (
    <summary>
      <span className="topnav-menu-drag" title={REORDER_LABEL} aria-hidden="true">
        <GripVertical size={16} />
      </span>
      <strong>
        <span className="topnav-menu-index">{index + 1}</span>
        <span>{title}</span>
      </strong>
      <ChevronDown className="topnav-menu-chevron" size={17} aria-hidden="true" />
      <button
        type="button"
        disabled={menus.length <= 1}
        aria-label={`${title} ${DELETE_LABEL}`}
        title={`${title} ${DELETE_LABEL}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </summary>
  );
}

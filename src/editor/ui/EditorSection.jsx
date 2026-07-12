import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function EditorSection({ id, title, icon: Icon, defaultOpen = false, tone = 'default', children }) {
  const generatedId = useId();
  const panelId = `editor-section-${id || generatedId}`;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`editor-section-v2 editor-section-v2-${tone}`} data-section={id || ''}>
      <button
        type="button"
        className="editor-section-v2-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {Icon && (
          <span className="editor-section-v2-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
        <span className="editor-section-v2-copy">
          <strong>{title}</strong>
        </span>
        <ChevronDown className="editor-section-v2-chevron" size={18} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="editor-section-v2-body">
          {children}
        </div>
      )}
    </section>
  );
}

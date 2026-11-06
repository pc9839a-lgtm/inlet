import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Native details owns keyboard semantics; React owns the expanded state so
// editing a field cannot silently reset it on an unrelated draft rerender.
export function InspectorDisclosure({ label, className = '', bodyClassName = '', defaultOpen = false, children }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <details className={`inspector-disclosure ${className}`.trim()} open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary>
        <strong>{label}</strong>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className={`inspector-disclosure-body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </details>
  );
}

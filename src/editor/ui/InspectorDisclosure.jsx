import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// An editor may remount its lazy block component whenever the draft changes.
// Preserve only per-block disclosure UI state, never any form/page data.
// Bound the in-memory cache; a new block/page still starts with its own default.
const expandedByBlock = new Map();
function rememberExpanded(key, expanded) {
  if (!key) return;
  if (expandedByBlock.size >= 240 && !expandedByBlock.has(key)) {
    expandedByBlock.delete(expandedByBlock.keys().next().value);
  }
  expandedByBlock.set(key, expanded);
}

export function InspectorDisclosure({ label, className = '', bodyClassName = '', defaultOpen = false, persistKey = '', children }) {
  const [expanded, setExpanded] = useState(() => (
    persistKey && expandedByBlock.has(persistKey)
      ? expandedByBlock.get(persistKey)
      : defaultOpen
  ));
  const onToggle = (event) => {
    const next = event.currentTarget.open;
    rememberExpanded(persistKey, next);
    setExpanded(next);
  };
  return (
    <details className={`inspector-disclosure ${className}`.trim()} open={expanded} onToggle={onToggle}>
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

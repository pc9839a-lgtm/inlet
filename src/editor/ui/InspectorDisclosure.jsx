import { ChevronDown } from 'lucide-react';

// A single reusable details/summary pattern for every editor's optional groups.
// The native details element preserves keyboard navigation and the open state.
export function InspectorDisclosure({ label, className = '', bodyClassName = '', defaultOpen = false, children }) {
  return (
    <details className={`inspector-disclosure ${className}`.trim()} open={defaultOpen}>
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

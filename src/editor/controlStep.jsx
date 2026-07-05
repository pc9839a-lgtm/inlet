import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function Step({ title, icon, children, open = false }) {
  const [isOpen, setOpen] = useState(open);
  return (
    <section className={`step ${isOpen ? 'open' : ''}`}>
      <button className="step-title" type="button" aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
        <span className="step-icon">{icon}</span>
        <strong>{title}</strong>
        <span className="step-chevron" aria-hidden="true">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {isOpen && <div className="step-body">{children}</div>}
    </section>
  );
}
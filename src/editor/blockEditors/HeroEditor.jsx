import { ChevronDown } from 'lucide-react';
import HeroBasicSection from './HeroBasicSection.jsx';
import HeroImageSection from './HeroImageSection.jsx';
import { HeroStylePanel } from './WidgetStylePanels.jsx';
import './HeroImageSection.css';

export default function HeroEditor({ s, set, Range, RichField }) {
  return (
    <div className="hero-editor-flow">
      <HeroBasicSection s={s} set={set} RichField={RichField} />
      <HeroImageSection s={s} set={set} Range={Range} />
      <details className="hero-editor-design">
        <summary>
          <strong>글자 디자인</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="hero-editor-design-controls">
          <HeroStylePanel s={s} set={set} />
        </div>
      </details>
    </div>
  );
}

import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import HeroBasicSection from './HeroBasicSection.jsx';
import HeroImageSection from './HeroImageSection.jsx';
import { HeroStylePanel } from './WidgetStylePanels.jsx';
import './HeroImageSection.css';

export default function HeroEditor({ s, set, Range, RichField, page }) {
  return (
    <div className="hero-editor-flow">
      <HeroBasicSection s={s} set={set} RichField={RichField} />
      <HeroImageSection s={s} set={set} Range={Range} />
      <InspectorDisclosure label="디자인" className="hero-editor-design" bodyClassName="hero-editor-design-controls">
        <HeroStylePanel s={s} set={set} theme={page?.theme} />
      </InspectorDisclosure>
    </div>
  );
}

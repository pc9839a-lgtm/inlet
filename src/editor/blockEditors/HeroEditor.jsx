import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import HeroBasicSection from './HeroBasicSection.jsx';
import HeroImageSection from './HeroImageSection.jsx';
import { HeroStylePanel } from './WidgetStylePanels.jsx';
import './HeroImageSection.css';

export default function HeroEditor({ s, set, Range, RichField, page, blockId }) {
  const stateKey = blockId ? `${page?.id || 'draft'}:${blockId}` : '';
  return (
    <div className="hero-editor-flow editor-task-flow" data-editor-task="hero">
      <h3 className="editor-task-inline-title">대표 문구</h3>
      <HeroBasicSection s={s} set={set} RichField={RichField} />
      <section className="editor-task-section" aria-label="대표 화면 이미지">
        <div className="editor-task-heading"><h3>대표 이미지</h3></div>
        <HeroImageSection s={s} set={set} Range={Range} stateKey={stateKey} />
      </section>
      <InspectorDisclosure label="디자인" className="hero-editor-design" bodyClassName="hero-editor-design-controls"
        persistKey={stateKey ? `${stateKey}:hero-design` : ''}>
        <HeroStylePanel s={s} set={set} theme={page?.theme} />
      </InspectorDisclosure>
    </div>
  );
}

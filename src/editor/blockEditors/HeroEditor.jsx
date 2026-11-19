import { InspectorDisclosure } from '../ui/InspectorDisclosure.jsx';
import HeroBasicSection from './HeroBasicSection.jsx';
import QuickDesignChoices from './QuickDesignChoices.jsx';
import HeroImageSection from './HeroImageSection.jsx';
import { HeroStylePanel } from './WidgetStylePanels.jsx';
import './HeroImageSection.css';

export default function HeroEditor({ s, set, Range, RichField, page, blockId }) {
  const stateKey = blockId ? `${page?.id || 'draft'}:${blockId}` : '';
  return (
    <div className="hero-editor-flow editor-task-flow" data-editor-task="hero">
      <h3 className="editor-task-inline-title">대표 문구</h3>
      <HeroBasicSection s={s} set={set} RichField={RichField} />
      <QuickDesignChoices
        kind="hero"
        selected={s.imageMode === 'background' ? 'photo' : (s.align === 'center' ? 'center' : 'top')}
        choices={[
          { value: 'top', label: '정돈된 기본' },
          { value: 'center', label: '중앙 강조' },
          ...(s.image ? [{ value: 'photo', label: '사진 배경' }] : []),
        ]}
        onSelect={(look) => set(look === 'photo'
          ? { imageMode: 'background', imageFit: 'cover', align: 'center', overlay: true, overlayOpacity: 42, titleSize: 'large' }
          : { imageMode: 'top', imageFit: 'contain', align: look === 'center' ? 'center' : 'left', titleSize: 'large' })}
      />
      <section className="editor-task-section" aria-label="대표 화면 이미지">
        <div className="editor-task-heading"><h3>대표 이미지</h3></div>
        <HeroImageSection s={s} set={set} Range={Range} stateKey={stateKey} />
      </section>
      <InspectorDisclosure label="세부 디자인" className="hero-editor-design" bodyClassName="hero-editor-design-controls"
        persistKey={stateKey ? `${stateKey}:hero-design` : ''}>
        <HeroStylePanel s={s} set={set} theme={page?.theme} />
      </InspectorDisclosure>
    </div>
  );
}

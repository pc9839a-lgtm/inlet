import { EditorStack } from '../controls.jsx';
import HeroBasicSection from './HeroBasicSection.jsx';
import HeroImageSection from './HeroImageSection.jsx';

export default function HeroEditor({ s, set, Range, RichField }) {
  return (
    <EditorStack>
      <HeroBasicSection s={s} set={set} RichField={RichField} />
      <HeroImageSection s={s} set={set} Range={Range} />
    </EditorStack>
  );
}

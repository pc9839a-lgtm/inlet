import { EditorTabs } from '../ui/index.js';
import HeroBasicSection from './HeroBasicSection.jsx';
import HeroImageSection from './HeroImageSection.jsx';

export default function HeroEditor({ s, set, Range, RichField }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: <HeroBasicSection s={s} set={set} RichField={RichField} />,
        },
        {
          id: 'image',
          label: '이미지',
          content: <HeroImageSection s={s} set={set} Range={Range} />,
        },
      ]}
    />
  );
}

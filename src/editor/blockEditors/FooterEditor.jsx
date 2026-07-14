import { EditorTabs } from '../ui/index.js';
import FooterBusinessSection from './FooterBusinessSection.jsx';
import FooterContactSection from './FooterContactSection.jsx';
import FooterLegalSection from './FooterLegalSection.jsx';
import { FooterStylePanel } from './WidgetStylePanels.jsx';

export default function FooterEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'business',
          label: '사업자',
          content: <FooterBusinessSection s={s} set={set} />,
        },
        {
          id: 'contact',
          label: '연락처',
          content: <FooterContactSection s={s} set={set} />,
        },
        {
          id: 'legal',
          label: '법적 문서',
          content: <FooterLegalSection s={s} set={set} />,
        },
        {
          id: 'style',
          label: '스타일',
          content: <FooterStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}

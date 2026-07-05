import { EditorStack } from '../controls.jsx';
import FooterBusinessSection from './FooterBusinessSection.jsx';
import FooterContactSection from './FooterContactSection.jsx';
import FooterLegalSection from './FooterLegalSection.jsx';

export default function FooterEditor({ s, set }) {
  return (
    <EditorStack>
      <FooterBusinessSection s={s} set={set} />
      <FooterContactSection s={s} set={set} />
      <FooterLegalSection s={s} set={set} />
    </EditorStack>
  );
}
import { EditorStack } from '../controls.jsx';
import SearchBasicSection from './SearchBasicSection.jsx';
import SearchDisplaySection from './SearchDisplaySection.jsx';

export default function SearchEditor({ s, set }) {
  return (
    <EditorStack>
      <SearchBasicSection s={s} set={set} />
      <SearchDisplaySection s={s} set={set} />
    </EditorStack>
  );
}
import { EditorTabs } from '../ui/index.js';
import SearchBasicSection from './SearchBasicSection.jsx';
import SearchDisplaySection from './SearchDisplaySection.jsx';

export default function SearchEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '내용',
          content: <SearchBasicSection s={s} set={set} />,
        },
        {
          id: 'display',
          label: '표시',
          content: <SearchDisplaySection s={s} set={set} />,
        },
      ]}
    />
  );
}

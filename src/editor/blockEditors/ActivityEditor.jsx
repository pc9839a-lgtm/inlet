import { EditorTabs } from '../ui/index.js';
import ActivityBasicSection from './ActivityBasicSection.jsx';
import ActivityDisplaySection from './ActivityDisplaySection.jsx';

export default function ActivityEditor({ s, set }) {
  const dataSource = s.dataSource || 'sample';
  const mode = s.mode || 'feed';

  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '데이터',
          content: <ActivityBasicSection s={s} set={set} dataSource={dataSource} />,
        },
        {
          id: 'display',
          label: '표시',
          content: <ActivityDisplaySection s={s} set={set} dataSource={dataSource} mode={mode} />,
        },
      ]}
    />
  );
}

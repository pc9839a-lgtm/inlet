import { EditorStack } from '../controls.jsx';
import ActivityBasicSection from './ActivityBasicSection.jsx';
import ActivityDisplaySection from './ActivityDisplaySection.jsx';

export default function ActivityEditor({ s, set }) {
  const dataSource = s.dataSource || 'sample';
  const mode = s.mode || 'feed';

  return (
    <EditorStack>
      <ActivityBasicSection s={s} set={set} dataSource={dataSource} />
      <ActivityDisplaySection s={s} set={set} dataSource={dataSource} mode={mode} />
    </EditorStack>
  );
}
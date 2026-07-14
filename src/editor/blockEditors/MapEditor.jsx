import { EditorTabs } from '../ui/index.js';
import MapDisplaySection from './MapDisplaySection.jsx';
import MapPlaceSection from './MapPlaceSection.jsx';
import { MapStylePanel } from './WidgetStylePanels.jsx';

export default function MapEditor({ s, set }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '장소',
          content: <MapPlaceSection s={s} set={set} />,
        },
        {
          id: 'display',
          label: '지도',
          content: <MapDisplaySection s={s} set={set} />,
        },
        {
          id: 'style',
          label: '스타일',
          content: <MapStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}

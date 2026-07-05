import { EditorStack } from '../controls.jsx';
import MapDisplaySection from './MapDisplaySection.jsx';
import MapPlaceSection from './MapPlaceSection.jsx';

export default function MapEditor({ s, set }) {
  return (
    <EditorStack>
      <MapPlaceSection s={s} set={set} />
      <MapDisplaySection s={s} set={set} />
    </EditorStack>
  );
}
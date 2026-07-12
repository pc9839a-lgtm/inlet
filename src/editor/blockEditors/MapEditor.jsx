import { MapPin, SlidersHorizontal } from 'lucide-react';
import { EditorSection } from '../ui/index.js';
import MapDisplaySection from './MapDisplaySection.jsx';
import MapPlaceSection from './MapPlaceSection.jsx';

export default function MapEditor({ s, set }) {
  return (
    <>
      <EditorSection id="content" title="장소 정보" description="지도와 함께 표시할 장소 정보를 입력합니다." icon={MapPin} defaultOpen>
        <MapPlaceSection s={s} set={set} />
      </EditorSection>
      <EditorSection id="design" title="지도 표시" description="지도 제공 방식과 높이를 설정합니다." icon={SlidersHorizontal}>
        <MapDisplaySection s={s} set={set} />
      </EditorSection>
    </>
  );
}
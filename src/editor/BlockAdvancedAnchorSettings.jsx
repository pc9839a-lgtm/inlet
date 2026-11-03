import { AnchorControl } from './AnchorControl.jsx';
import { InspectorDisclosure } from './ui/InspectorDisclosure.jsx';

export function BlockAdvancedAnchorSettings({ block, set }) {
  return (
    <InspectorDisclosure label="고급 설정 · 이동 앵커" className="block-editor-advanced-settings" bodyClassName="block-editor-advanced-body">
      <p className="block-editor-advanced-description">버튼의 화면 이동 대상에 사용하는 주소입니다.</p>
      <AnchorControl block={block} value={block.s?.anchorId || ''} set={set} />
    </InspectorDisclosure>
  );
}

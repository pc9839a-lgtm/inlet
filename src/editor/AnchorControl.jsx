import { anchorPatch, copyAnchorText } from './anchorControlModel.js';

export function AnchorControl({ block, value, set }) {
  const copy = () => copyAnchorText(value);
  const changeAnchor = (nextValue) => set(anchorPatch(nextValue, block.type));

  return (
    <div className="anchor-control block-editor-anchor-control">
      <span>위젯 코드</span>
      <div>
        <b>#</b>
        <input value={value || ''} onChange={(event) => changeAnchor(event.target.value)} placeholder="widget-code" />
        <button type="button" onClick={copy}>복사</button>
      </div>
    </div>
  );
}
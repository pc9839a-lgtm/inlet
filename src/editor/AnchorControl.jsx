import { anchorPatch, copyAnchorText } from './anchorControlModel.js';

export function AnchorControl({ block, value, set }) {
  const copy = () => copyAnchorText(value);
  const changeAnchor = (nextValue) => set(anchorPatch(nextValue, block.type));

  return (
    <div className="anchor-control block-editor-anchor-control">
      <span className="block-editor-anchor-label">위젯 코드</span>
      <div className="block-editor-anchor-value">
        <b aria-hidden="true">#</b>
        <input
          value={value || ''}
          onChange={(event) => changeAnchor(event.target.value)}
          placeholder="widget-code"
          aria-label="위젯 코드"
        />
        <button type="button" onClick={copy}>복사</button>
      </div>
    </div>
  );
}

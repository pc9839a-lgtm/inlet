import { META } from '../../config/blockMeta.jsx';

export function BlockEditorShell({ blockType, children }) {
  const meta = META[blockType] || META.text;

  return (
    <section className="block-editor-v2" data-block-type={blockType} aria-label={`${meta.label} 편집`}>
      <div className="block-editor-v2-content">{children}</div>
    </section>
  );
}
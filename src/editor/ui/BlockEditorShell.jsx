import { META } from '../../config/blockMeta.jsx';

export function BlockEditorShell({ blockType, children }) {
  const meta = META[blockType] || META.text;
  const Icon = meta.icon;

  return (
    <section className="block-editor-v2" data-block-type={blockType} aria-label={`${meta.label} 편집`}>
      <header className="block-editor-v2-header">
        <span className="block-editor-v2-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="block-editor-v2-heading">
          <strong>{meta.label} 편집</strong>
        </span>
      </header>
      <div className="block-editor-v2-content">{children}</div>
    </section>
  );
}

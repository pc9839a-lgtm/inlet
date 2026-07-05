export function EditorStack({ children }) {
  return <div className="editor-stack">{children}</div>;
}

export function Two({ children }) {
  return <div className="two-col">{children}</div>;
}

export function LineList({ children }) {
  return <div className="mini-list">{children}</div>;
}

export function MiniDetail({ icon, title, badge, children }) {
  return (
    <details className="mini-detail">
      <summary>
        <span>{icon}</span>
        <strong>{title}</strong>
        {badge && <em>{badge}</em>}
      </summary>
      <div className="mini-body">{children}</div>
    </details>
  );
}
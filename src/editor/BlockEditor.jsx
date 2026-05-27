import { Component, Suspense } from 'react';
import { slugifyAnchor } from '../lib/pageModel.js';

const LAZY_EDITOR_FALLBACK_TEXT = '편집기를 불러오는 중입니다.';
const LAZY_EDITOR_ERROR_TEXT = '편집기를 불러오지 못했습니다. 블록을 다시 열거나 새로고침해 주세요.';

export default function BlockEditor({ block, page, updateBlock, editors, editorDeps = {} }) {
  const s = block.s || {};
  const set = (patch) => updateBlock(block.id, patch);
  const Editor = editors?.[block.type];

  if (!Editor) return null;

  const props = { s, set, page, ...editorDeps };
  if (block.type === 'image') props.block = block;

  return (
    <>
      <AnchorControl value={s.anchorId || ''} onChange={(value) => set({ anchorId: slugifyAnchor(value, block.type) })} />
      <LazyEditorErrorBoundary resetKey={`${block.id}:${block.type}`}>
        <Suspense fallback={<div className="muted small" data-lazy-editor-fallback="true">{LAZY_EDITOR_FALLBACK_TEXT}</div>}>
          <Editor {...props} />
        </Suspense>
      </LazyEditorErrorBoundary>
    </>
  );
}

class LazyEditorErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.warn('Block editor load failed:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="muted small" role="alert" data-lazy-editor-error="true">
          {LAZY_EDITOR_ERROR_TEXT}
        </div>
      );
    }

    return this.props.children;
  }
}

function AnchorControl({ value, onChange }) {
  const copy = async () => {
    const text = `#${value || ''}`;
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // Clipboard can be blocked in some browser contexts.
    }
  };

  return (
    <div className="anchor-control">
      <span>위젯 코드</span>
      <div>
        <b>#</b>
        <input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="widget-code" />
        <button type="button" onClick={copy}>복사</button>
      </div>
    </div>
  );
}

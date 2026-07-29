import { Component, Suspense } from 'react';
import { forceCanonicalRuntime } from '../runtime/LazyRuntimeBoundary.jsx';

const LAZY_EDITOR_ERROR_TEXT = '편집기를 불러오지 못했습니다. 블록을 다시 열거나 새로고침해 주세요.';

export function LazyEditorBoundary({ resetKey, children }) {
  return (
    <LazyEditorErrorBoundary resetKey={resetKey}>
      <Suspense fallback={<div className="lazy-editor-fallback" data-lazy-editor-fallback="true" aria-hidden="true" />}>
        {children}
      </Suspense>
    </LazyEditorErrorBoundary>
  );
}

class LazyEditorErrorBoundary extends Component {
  state = { error: null, recovering: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.warn('Block editor load failed:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, recovering: false });
    }
  }

  render() {
    if (this.state.recovering) {
      return <div className="lazy-editor-fallback" aria-hidden="true" />;
    }
    if (this.state.error) {
      return (
        <div className="muted small lazy-editor-error" role="alert" data-lazy-editor-error="true">
          <span>{LAZY_EDITOR_ERROR_TEXT}</span>
          <button type="button" onClick={forceCanonicalRuntime}>다시 불러오기</button>
        </div>
      );
    }

    return this.props.children;
  }
}
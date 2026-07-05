import { Component, Suspense } from 'react';

const LAZY_EDITOR_FALLBACK_TEXT = '편집기를 불러오는 중입니다.';
const LAZY_EDITOR_ERROR_TEXT = '편집기를 불러오지 못했습니다. 블록을 다시 열거나 새로고침해 주세요.';

export function LazyEditorBoundary({ resetKey, children }) {
  return (
    <LazyEditorErrorBoundary resetKey={resetKey}>
      <Suspense fallback={<div className="muted small" data-lazy-editor-fallback="true">{LAZY_EDITOR_FALLBACK_TEXT}</div>}>
        {children}
      </Suspense>
    </LazyEditorErrorBoundary>
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
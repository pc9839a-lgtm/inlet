import React from 'react';
import { EVENTS_KEY, LEADS_KEY, START_MODE_KEY, STORAGE_KEY } from '../config/storageKeys.js';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || this.state.error || '알 수 없는 오류');

    return (
      <div className="error-screen error-screen-v2">
        <div>
          <h1>화면을 불러오는 중 오류가 발생했습니다.</h1>
          <p>{message}</p>
          <div className="error-actions">
            <button onClick={() => location.reload()}>다시 열기</button>
            <button onClick={() => { localStorage.removeItem(STORAGE_KEY); location.reload(); }}>페이지 설정만 초기화</button>
            <button
              className="danger"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(LEADS_KEY);
                localStorage.removeItem(EVENTS_KEY);
                localStorage.removeItem(START_MODE_KEY);
                location.reload();
              }}
            >
              전체 초기화
            </button>
          </div>
        </div>
      </div>
    );
  }
}

import { AiPanel } from '../ai/AiPanel.jsx';
import { START_MODE_KEY } from '../config/storageKeys.js';
import { Field } from '../editor/controls.jsx';
import { notify } from '../lib/uiFeedback.js';
import './AdminPanel.css';

export default function AdminPanel({ page, updatePage, updateAi, setPage, setStartMode, authUser = null, onExit }) {
  return (
    <div className="simple-panel settings-panel admin-panel">
      <section className="card">
        <div className="section-title">
          <div>
            <h2>내부 관리자</h2>
            <p>공개 작업 메뉴가 아닌 로그인한 마스터 전용 관리 화면입니다.</p>
          </div>
          {onExit && <button type="button" onClick={onExit}>작업 화면으로</button>}
        </div>
        <div className="settings-grid">
          <Field label="프로젝트 ID" value={page.projectId || ''} onChange={(value) => updatePage({ projectId: value.replace(/[^a-zA-Z0-9-_]/g, '') })} />
          <Field label="관리자 계정" value={authUser?.email || ''} onChange={() => {}} />
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              localStorage.removeItem(START_MODE_KEY);
              setStartMode('');
              notify('시작 선택 화면을 다시 열도록 설정했습니다.', 'success');
            }}
          >
            시작 화면 다시 선택
          </button>
        </div>
      </section>

      <AiPanel page={page} updateAi={updateAi} setPage={setPage} authUser={authUser} />
    </div>
  );
}

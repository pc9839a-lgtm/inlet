import { useEffect, useState } from 'react';
import { Choice, EditorStack, Field, Step, Toggle } from '../controls.jsx';

export function CodeEditor({ s, set }) {
  const [draft, setDraft] = useState(s.html || '');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setDraft(s.html || '');
  }, [s.html]);

  const apply = () => {
    set({ html: draft, css: '', js: '', runJs: false, height: 'auto' });
    setModalOpen(false);
  };

  return (
    <EditorStack>
      <Step title="코드" icon="1" open>
        <div className="code-editor-box">
          <div className="code-editor-head">
            <strong>코드 입력</strong>
            <button type="button" onClick={() => setModalOpen(true)}>크게 편집</button>
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="HTML 코드를 입력하세요."
            spellCheck={false}
          />
          <div className="code-editor-actions">
            <span>저장할 때 위험한 코드는 자동으로 제거됩니다.</span>
            <button type="button" onClick={apply}>저장</button>
          </div>
        </div>
      </Step>
      {modalOpen && (
        <div className="code-editor-modal" role="dialog" aria-modal="true">
          <div className="code-editor-modal-card">
            <div className="code-editor-modal-head">
              <strong>코드 편집</strong>
              <button type="button" onClick={() => setModalOpen(false)}>닫기</button>
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="HTML 코드를 입력하세요."
              spellCheck={false}
              autoFocus
            />
            <div className="code-editor-modal-actions">
              <span>저장할 때 위험한 코드는 자동으로 제거됩니다.</span>
              <button type="button" onClick={apply}>저장</button>
            </div>
          </div>
        </div>
      )}
    </EditorStack>
  );
}

export function SearchEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="제목" value={s.title || '페이지 검색'} onChange={(v) => set({ title: v })} />
        <Field label="안내 문구" value={s.placeholder || '찾을 내용을 입력하세요'} onChange={(v) => set({ placeholder: v })} />
        <Field label="결과 없음" value={s.emptyText || '일치하는 내용이 없습니다.'} onChange={(v) => set({ emptyText: v })} />
      </Step>

      <Step title="표시" icon="2">
        <Choice
          label="형태"
          value={s.layout || 'card'}
          onChange={(v) => set({ layout: v })}
          options={[['card', '카드'], ['bar', '바'], ['minimal', '심플']]}
        />
        <Toggle label="실시간 검색" checked={s.live !== false} onChange={(v) => set({ live: v })} />
      </Step>
    </EditorStack>
  );
}

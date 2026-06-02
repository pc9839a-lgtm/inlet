import { Choice, EditorStack, Field, Step } from '../controls.jsx';

export function ActivityEditor({ s, set }) {
  const dataSource = s.dataSource || 'sample';
  const mode = s.mode || 'feed';

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="제목" value={s.title || '접수현황'} onChange={(v) => set({ title: v })} />
        <Choice label="데이터" value={dataSource} onChange={(v) => set({ dataSource: v })} options={[['sample', '예시'], ['live', '실제 접수']]} />
        {dataSource === 'sample' && (
          <Choice label="예시 유형" value={s.sampleKind || 'both'} onChange={(v) => set({ sampleKind: v })} options={[['consult', '상담'], ['reservation', '예약'], ['both', '전체']]} />
        )}
        <Choice label="표시" value={mode} onChange={(v) => set({ mode: v })} options={[['feed', '접수목록'], ['count', '숫자']]} />
        {mode === 'count' && dataSource === 'sample' && (
          <Field label="예시 숫자" type="number" value={s.baseCount ?? 12} onChange={(v) => set({ baseCount: Number(v) })} />
        )}
      </Step>
    </EditorStack>
  );
}

export function SpacerEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <div className="spacer-editor-card">
          <span>높이</span>
          <input type="range" min="8" max="200" step="4" value={Number(s.height ?? 40)} onChange={(e) => set({ height: Number(e.target.value) })} />
          <b>{Number(s.height ?? 40)}px</b>
        </div>
      </Step>
    </EditorStack>
  );
}

export function DividerEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <div className="spacer-editor-card">
          <span>길이</span>
          <input type="range" min="10" max="100" step="5" value={Number(s.width ?? 100)} onChange={(e) => set({ width: Number(e.target.value) })} />
          <b>{Number(s.width ?? 100)}%</b>
        </div>
        <div className="spacer-editor-card">
          <span>두께</span>
          <input type="range" min="1" max="8" step="1" value={Number(s.thickness ?? 1)} onChange={(e) => set({ thickness: Number(e.target.value) })} />
          <b>{Number(s.thickness ?? 1)}px</b>
        </div>
      </Step>
    </EditorStack>
  );
}

export function FooterEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="상호명" value={s.company} onChange={(v) => set({ company: v })} />
        <Field label="대표자" value={s.owner} onChange={(v) => set({ owner: v })} />
        <Field label="연락처" value={s.phone} onChange={(v) => set({ phone: v })} />
      </Step>
      <Step title="추가 정보" icon="2">
        <Field label="이메일" value={s.email} onChange={(v) => set({ email: v })} />
        <Field label="주소" value={s.address} onChange={(v) => set({ address: v })} />
        <Field label="사업자번호" value={s.biz} onChange={(v) => set({ biz: v })} />
      </Step>
      <Step title="고급" icon="3">
        <Field label="개인정보처리방침" value={s.privacyUrl} onChange={(v) => set({ privacyUrl: v })} />
        <Field label="이용약관" value={s.termsUrl} onChange={(v) => set({ termsUrl: v })} />
      </Step>
    </EditorStack>
  );
}

export default function PageDuplicateUrlModal({
  canDuplicatePage,
  duplicateBlocked,
  duplicateDraft,
  duplicateIssues,
  onClose,
  onDuplicate,
  setDuplicateField,
}) {
  return (
    <div className="settings-modal-backdrop" role="presentation">
      <section className="settings-url-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-url-title">
        <div className="settings-url-modal-head">
          <div>
            <span>페이지 복제</span>
            <h2 id="duplicate-url-title">URL 설정</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">닫기</button>
        </div>

        <div className="settings-url-choice" role="group" aria-label="도메인 선택">
          <button type="button" className={duplicateDraft.domainType === 'default' ? 'active' : ''} onClick={() => setDuplicateField('domainType', 'default')}>기본 제공 도메인</button>
          <button type="button" className={duplicateDraft.domainType === 'custom' ? 'active' : ''} onClick={() => setDuplicateField('domainType', 'custom')}>개인 도메인</button>
        </div>

        <div className="settings-url-form">
          <label>
            <span>URL 경로</span>
            <input value={duplicateDraft.slug} onChange={(event) => setDuplicateField('slug', event.target.value)} placeholder="new-page" />
          </label>
          {duplicateDraft.domainType === 'custom' && (
            <label>
              <span>개인 도메인</span>
              <input value={duplicateDraft.customDomain} onChange={(event) => setDuplicateField('customDomain', event.target.value)} placeholder="landing.example.com" />
              <small>저장 후 DNS 확인 대기 상태로 기록됩니다.</small>
            </label>
          )}
        </div>

        {duplicateIssues.length > 0 && <p className="settings-url-error">{duplicateIssues[0]}</p>}
        {!canDuplicatePage && <p className="settings-url-lock">유료 기능 잠금 상태입니다. 결제 기능이 연결되면 이 URL 설정으로 페이지 복제를 진행합니다.</p>}

        <div className="settings-url-modal-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="button" className="primary" disabled={duplicateBlocked} onClick={onDuplicate}>페이지 복제</button>
        </div>
      </section>
    </div>
  );
}

export default function AccountPasswordForm({ changing, onChangePassword, onSendCode, passwordDraft, setPasswordField, verifying }) {
  return (
    <form className="account-password-form" onSubmit={onChangePassword}>
      <div className="account-password-head">
        <strong>???? ??</strong>
        <button type="button" disabled={verifying} onClick={onSendCode}>{verifying ? '?? ?' : '?? ?? ???'}</button>
      </div>
      <div className="account-settings-grid">
        <label>
          <span>?? ??</span>
          <input value={passwordDraft.code} onChange={(event) => setPasswordField('code', event.target.value)} placeholder="??? ?? ??" />
        </label>
        <label>
          <span>? ????</span>
          <input type="password" value={passwordDraft.password} onChange={(event) => setPasswordField('password', event.target.value)} placeholder="??+?? 6?? ??" />
        </label>
        <label>
          <span>? ???? ??</span>
          <input type="password" value={passwordDraft.password2} onChange={(event) => setPasswordField('password2', event.target.value)} placeholder="?? ??" />
        </label>
        <div className="account-settings-actions">
          <button type="submit" disabled={changing}>{changing ? '?? ?' : '???? ??'}</button>
        </div>
      </div>
    </form>
  );
}

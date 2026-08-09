export default function ManagerDetailActions({
  copyInvite,
  createInvite,
  disableManager,
  disabledManager,
  inviteUrl,
  loading,
  locked,
  menuExpanded,
  removeManager,
  toggleMenu,
}) {
  const inviteLabel = loading
    ? '처리 중'
    : inviteUrl
      ? '초대 링크 복사'
      : '초대 링크 만들기';

  return (
    <div className="manager-detail-actions">
      <div className="manager-detail-primary-actions">
        <button type="button" className="settings-secondary-button" onClick={toggleMenu}>
          {menuExpanded ? '메뉴 권한 닫기' : '메뉴 권한 설정'}
        </button>
        <button
          type="button"
          className="settings-secondary-button"
          onClick={inviteUrl ? copyInvite : createInvite}
          disabled={locked || disabledManager || loading}
        >
          {inviteLabel}
        </button>
      </div>
      <div className="manager-detail-danger-actions">
        {!disabledManager && (
          <button type="button" className="settings-secondary-button" disabled={locked} onClick={disableManager}>비활성화</button>
        )}
        <button type="button" className="settings-danger-button" disabled={locked} onClick={removeManager}>매니저 삭제</button>
      </div>
    </div>
  );
}

export default function ManagerDetailActions({
  copyInvite,
  createInvite,
  disabledManager,
  inviteUrl,
  loading,
  locked,
  menuExpanded,
  toggleMenu,
}) {
  const inviteLabel = loading
    ? '\uCC98\uB9AC \uC911'
    : inviteUrl
      ? '\uCD08\uB300 \uB9C1\uD06C \uBCF5\uC0AC'
      : '\uCD08\uB300 \uB9C1\uD06C \uB9CC\uB4E4\uAE30';

  return (
    <div className="manager-detail-actions">
      <button type="button" onClick={toggleMenu}>{menuExpanded ? '\uBA54\uB274 \uAD8C\uD55C \uB2EB\uAE30' : '\uBA54\uB274 \uAD8C\uD55C'}</button>
      <button type="button" onClick={inviteUrl ? copyInvite : createInvite} disabled={locked || disabledManager || loading}>{inviteLabel}</button>
    </div>
  );
}

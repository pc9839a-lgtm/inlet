import { RefreshCw } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

export default function ReferralSettingsSection({ authUser }) {
  const { finance, loading, error, refresh } = useAccountFinance(authUser);
  const referral = finance?.referral || {};

  return (
    <SettingsSection id="referral" className="settings-referral-card settings-flat-section">
      <div className="settings-flat-block">
        <div className="settings-flat-block-head">
          <strong>추천인</strong>
          <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> 새로고침
          </button>
        </div>

        {error && <p className="settings-message error" role="alert">{error}</p>}

        {loading && !finance ? (
          <div className="settings-loading">불러오는 중</div>
        ) : (
          <div className="settings-compact-rows">
            <div className="settings-compact-row"><span>등록 상태</span><strong>{referral.locked ? (referral.registeredCode || '등록 완료') : '미등록'}</strong><em>{referral.locked ? '적용 완료' : '-'}</em></div>
            <div className="settings-compact-row"><span>가입 혜택</span><strong>클래식 7일</strong><em>-</em></div>
            <div className="settings-compact-row"><span>등록 시점</span><strong>회원가입 시 1회</strong><em>-</em></div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

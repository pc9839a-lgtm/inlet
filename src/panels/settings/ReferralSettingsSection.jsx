import { Gift, RefreshCw } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

export default function ReferralSettingsSection({ authUser }) {
  const { finance, loading, error, refresh } = useAccountFinance(authUser);
  const referral = finance?.referral || {};

  return (
    <SettingsSection id="referral" className="settings-referral-card">
      <div className="settings-stack">
        <section className="settings-surface">
          <header className="settings-surface-head">
            <div className="settings-icon-title">
              <span className="settings-icon-box"><Gift size={19} aria-hidden="true" /></span>
              <div>
                <strong>추천인 상태</strong>
                <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
              </div>
            </div>
            <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" /> 새로고침
            </button>
          </header>

          {error && <p className="settings-message error" role="alert">{error}</p>}

          {loading && !finance ? (
            <div className="settings-loading">추천 정보를 불러오는 중입니다.</div>
          ) : (
            <div className="settings-info-list">
              <div className="settings-info-row">
                <div>
                  <span>등록 상태</span>
                  <strong>{referral.locked ? (referral.registeredCode || '등록 완료') : '등록된 추천인 없음'}</strong>
                </div>
                <span className={`settings-status-badge ${referral.locked ? 'success' : ''}`}>
                  {referral.locked ? '적용 완료' : '미등록'}
                </span>
              </div>
              <div className="settings-info-row">
                <div>
                  <span>가입 혜택</span>
                  <strong>클래식 7일 이용권</strong>
                  <small>회원가입할 때 추천인 코드를 입력한 경우 적용됩니다.</small>
                </div>
              </div>
              <div className="settings-info-row">
                <div>
                  <span>등록 정책</span>
                  <strong>회원가입 시 1회만 입력 가능</strong>
                  <small>가입 완료 후 설정 화면에서는 추천인 코드를 추가하거나 변경할 수 없습니다.</small>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </SettingsSection>
  );
}

import { Gift, RefreshCw, TicketCheck } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

export default function ReferralSettingsSection({ authUser, openSection, setOpenSection }) {
  const { finance, loading, error, refresh } = useAccountFinance(authUser);
  const referral = finance?.referral || {};

  return (
    <SettingsSection
      id="referral"
      title="추천인"
      description="회원가입 추천 혜택"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-referral-card"
    >
      <div className="account-referral-settings">
        <header className="account-finance-head">
          <div>
            <Gift size={20} aria-hidden="true" />
            <div>
              <strong>추천인 혜택</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">추천 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="referral-signup-policy">
              <TicketCheck size={24} aria-hidden="true" />
              <div>
                <strong>회원가입할 때 추천인 코드를 입력하면 페이지로 클래식 7일 이용권이 적용됩니다.</strong>
                <small>추천인 코드는 회원가입 화면에서만 한 번 입력할 수 있으며 가입 후에는 추가하거나 변경할 수 없습니다.</small>
              </div>
            </section>

            <section className="referral-registration-status">
              <span>등록 상태</span>
              {referral.locked ? (
                <div>
                  <strong>{referral.registeredCode || '등록 완료'}</strong>
                  <small>페이지로 클래식 7일 이용권 적용</small>
                </div>
              ) : (
                <div>
                  <strong>등록된 추천인 없음</strong>
                  <small>이미 가입한 계정에서는 추천인 코드를 등록할 수 없습니다.</small>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

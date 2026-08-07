import { CheckCircle2, Gift, RefreshCw, TicketCheck } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

export default function ReferralSettingsSection({ authUser, openSection, setOpenSection }) {
  const { finance, loading, error, refresh } = useAccountFinance(authUser);
  const referral = finance?.referral || {};

  return (
    <SettingsSection
      id="referral"
      title="추천인"
      description="가입 추천 혜택과 등록 상태"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-referral-card"
    >
      <div className="account-referral-settings service-content-v2">
        <header className="account-finance-head service-content-head">
          <div>
            <Gift size={20} aria-hidden="true" />
            <div>
              <strong>추천인</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="추천 정보 새로고침">
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">추천 정보를 불러오는 중입니다.</div>
        ) : (
          <div className="referral-service-grid">
            <section className="referral-benefit-card">
              <span className="service-card-icon"><TicketCheck size={20} aria-hidden="true" /></span>
              <div>
                <small>가입 혜택</small>
                <strong>클래식 7일 이용권</strong>
                <p>회원가입할 때 추천인 코드를 입력한 경우 적용됩니다.</p>
              </div>
            </section>

            <section className={`referral-status-card ${referral.locked ? 'is-complete' : ''}`}>
              <span className="service-card-icon"><CheckCircle2 size={20} aria-hidden="true" /></span>
              <div>
                <small>등록 상태</small>
                <strong>{referral.locked ? (referral.registeredCode || '등록 완료') : '등록된 추천인 없음'}</strong>
                <p>{referral.locked ? '혜택 적용 완료' : '추천인 코드는 회원가입 시에만 입력할 수 있습니다.'}</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

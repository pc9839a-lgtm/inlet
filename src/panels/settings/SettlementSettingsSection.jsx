import { ExternalLink, RefreshCw, WalletCards } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

const SETTLEMENT_URL = 'https://calltag.pagero.kr/web/settlement';

function money(value = 0) {
  return `${Math.max(0, Number(value || 0)).toLocaleString('ko-KR')}원`;
}

export default function SettlementSettingsSection({ authUser, openSection, setOpenSection }) {
  const { finance, loading, error, refresh } = useAccountFinance(authUser);
  const settlement = finance?.settlement?.combined || {};

  return (
    <SettingsSection
      id="settlement"
      title="정산"
      description="페이지로·콜태그 통합 정산"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-settlement-card"
    >
      <div className="account-settlement-settings">
        <header className="account-finance-head">
          <div>
            <WalletCards size={20} aria-hidden="true" />
            <div>
              <strong>통합 정산</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">정산 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="settlement-overview-panel">
              <div><span>이번 달 예상 정산</span><strong>{money(settlement.estimatedRevenueKrw)}</strong></div>
              <div><span>누적 확정 정산</span><strong>{money(settlement.confirmedRevenueKrw)}</strong></div>
              <div><span>추천 가입</span><strong>{Number(settlement.referredCount || 0)}명</strong></div>
              <div><span>유료 전환</span><strong>{Number(settlement.activePaidCount || 0)}명</strong></div>
            </section>

            <section className="settlement-link-panel">
              <div>
                <strong>페이지로·콜태그 정산 페이지</strong>
                <small>동일 계정의 페이지로와 콜태그 수익을 합산한 정산 내역을 확인합니다.</small>
              </div>
              <a href={SETTLEMENT_URL} target="_blank" rel="noreferrer">
                정산 페이지 열기 <ExternalLink size={17} aria-hidden="true" />
              </a>
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

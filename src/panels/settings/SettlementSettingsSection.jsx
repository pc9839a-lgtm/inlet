import { ExternalLink, RefreshCw, TrendingUp, UserPlus, WalletCards } from 'lucide-react';
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
      <div className="account-settlement-settings service-content-v2">
        <header className="account-finance-head service-content-head">
          <div>
            <WalletCards size={20} aria-hidden="true" />
            <div>
              <strong>정산 현황</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="정산 정보 새로고침">
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">정산 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="settlement-metric-grid">
              <div className="settlement-metric primary">
                <span><WalletCards size={17} />이번 달 예상</span>
                <strong>{money(settlement.estimatedRevenueKrw)}</strong>
              </div>
              <div className="settlement-metric">
                <span><TrendingUp size={17} />누적 확정</span>
                <strong>{money(settlement.confirmedRevenueKrw)}</strong>
              </div>
              <div className="settlement-metric">
                <span><UserPlus size={17} />추천 가입</span>
                <strong>{Number(settlement.referredCount || 0)}명</strong>
              </div>
              <div className="settlement-metric">
                <span><TrendingUp size={17} />유료 전환</span>
                <strong>{Number(settlement.activePaidCount || 0)}명</strong>
              </div>
            </section>

            <section className="settlement-cta-card">
              <div>
                <strong>콜태그 × 페이지로 통합 정산</strong>
                <small>서비스별 수익, 확정 금액, 지급 내역을 한 화면에서 확인합니다.</small>
              </div>
              <a href={SETTLEMENT_URL} target="_blank" rel="noreferrer">
                정산 내역 보기 <ExternalLink size={16} aria-hidden="true" />
              </a>
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

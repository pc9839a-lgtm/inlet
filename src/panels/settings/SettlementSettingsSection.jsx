import { ExternalLink, RefreshCw, WalletCards } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

const SETTLEMENT_URL = 'https://calltag.pagero.kr/web/settlement';

function money(value = 0) {
  return `${Math.max(0, Number(value || 0)).toLocaleString('ko-KR')}원`;
}

export default function SettlementSettingsSection({ authUser }) {
  const { finance, loading, error, refresh } = useAccountFinance(authUser);
  const settlement = finance?.settlement?.combined || {};

  return (
    <SettingsSection id="settlement" className="settings-settlement-card">
      <div className="settings-stack">
        <section className="settings-surface">
          <header className="settings-surface-head">
            <div className="settings-icon-title">
              <span className="settings-icon-box"><WalletCards size={19} aria-hidden="true" /></span>
              <div>
                <strong>통합 정산 현황</strong>
                <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
              </div>
            </div>
            <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" /> 새로고침
            </button>
          </header>

          {error && <p className="settings-message error" role="alert">{error}</p>}

          {loading && !finance ? (
            <div className="settings-loading">정산 정보를 불러오는 중입니다.</div>
          ) : (
            <>
              <div className="settlement-metric-grid settings-metric-grid">
                <div className="settlement-metric primary"><span>이번 달 예상</span><strong>{money(settlement.estimatedRevenueKrw)}</strong></div>
                <div className="settlement-metric"><span>누적 확정</span><strong>{money(settlement.confirmedRevenueKrw)}</strong></div>
                <div className="settlement-metric"><span>추천 가입</span><strong>{Number(settlement.referredCount || 0)}명</strong></div>
                <div className="settlement-metric"><span>유료 전환</span><strong>{Number(settlement.activePaidCount || 0)}명</strong></div>
              </div>

              <div className="settings-info-list settlement-info-list">
                <div className="settings-info-row">
                  <div>
                    <span>정산 기준</span>
                    <strong>추천 사용자의 페이지로·콜태그 결제 금액 20%</strong>
                    <small>확정 금액과 실제 지급 내역은 통합 정산 페이지에서 관리합니다.</small>
                  </div>
                </div>
                <div className="settings-info-row">
                  <div>
                    <span>상세 내역</span>
                    <strong>콜태그 × 페이지로 통합 정산</strong>
                    <small>서비스별 수익, 확정 금액, 지급 내역을 한 화면에서 확인합니다.</small>
                  </div>
                  <a className="settings-primary-button compact" href={SETTLEMENT_URL} target="_blank" rel="noreferrer">
                    정산 내역 보기 <ExternalLink size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </SettingsSection>
  );
}

import { ExternalLink, RefreshCw } from 'lucide-react';
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
    <SettingsSection id="settlement" className="settings-settlement-card settings-flat-section">
      <div className="settings-flat-block">
        <div className="settings-flat-block-head">
          <strong>정산</strong>
          <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> 새로고침
          </button>
        </div>

        {error && <p className="settings-message error" role="alert">{error}</p>}

        {loading && !finance ? (
          <div className="settings-loading">불러오는 중</div>
        ) : (
          <>
            <div className="settlement-metric-grid settings-metric-grid">
              <div className="settlement-metric primary"><span>이번 달</span><strong>{money(settlement.estimatedRevenueKrw)}</strong></div>
              <div className="settlement-metric"><span>누적 확정</span><strong>{money(settlement.confirmedRevenueKrw)}</strong></div>
              <div className="settlement-metric"><span>추천 가입</span><strong>{Number(settlement.referredCount || 0)}명</strong></div>
              <div className="settlement-metric"><span>유료 전환</span><strong>{Number(settlement.activePaidCount || 0)}명</strong></div>
            </div>

            <div className="settings-compact-rows">
              <div className="settings-compact-row"><span>정산율</span><strong>20%</strong><em>페이지로 · 콜태그</em></div>
              <div className="settings-compact-row settings-compact-row-action">
                <span>상세 내역</span>
                <strong>통합 정산</strong>
                <a className="settings-primary-button compact" href={SETTLEMENT_URL} target="_blank" rel="noreferrer">
                  보기 <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

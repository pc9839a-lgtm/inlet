import { Clipboard, RefreshCw, UsersRound } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

const SETTLEMENT_URL = 'https://calltag.pagero.kr/web/settlement';

function money(value = 0) {
  return `${Math.max(0, Number(value || 0)).toLocaleString('ko-KR')}원`;
}

async function copyText(value = '') {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export default function PartnerSettingsSection({ authUser }) {
  const { finance, loading, error, notice, refresh, setNotice } = useAccountFinance(authUser);
  const referral = finance?.referral || {};
  const settlement = finance?.settlement?.combined || {};

  const copyPartnerCode = async () => {
    if (!referral.code) return;
    try {
      await copyText(referral.code);
      setNotice('파트너 코드를 복사했습니다.');
    } catch {
      setNotice('복사하지 못했습니다.');
    }
  };

  return (
    <SettingsSection id="partner" className="settings-partner-card">
      <div className="settings-stack">
        <section className="settings-surface">
          <header className="settings-surface-head">
            <div className="settings-icon-title">
              <span className="settings-icon-box"><UsersRound size={19} aria-hidden="true" /></span>
              <div>
                <strong>파트너 현황</strong>
                <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
              </div>
            </div>
            <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" /> 새로고침
            </button>
          </header>

          {error && <p className="settings-message error" role="alert">{error}</p>}
          {notice && <p className="settings-message" role="status">{notice}</p>}

          {loading && !finance ? (
            <div className="settings-loading">파트너 정보를 불러오는 중입니다.</div>
          ) : (
            <>
              <div className="partner-metric-grid settings-metric-grid">
                <div><span>추천 가입</span><strong>{Number(referral.referralCount || 0)}명</strong></div>
                <div><span>유료 전환</span><strong>{Number(referral.activePaidCount || 0)}명</strong></div>
                <div><span>이번 달 예상</span><strong>{money(settlement.estimatedRevenueKrw)}</strong></div>
                <div><span>누적 확정</span><strong>{money(settlement.confirmedRevenueKrw)}</strong></div>
              </div>

              <div className="settings-info-list partner-code-list">
                <div className="settings-info-row">
                  <div>
                    <span>내 파트너 코드</span>
                    <strong className="settings-mono-value">{referral.code || '-'}</strong>
                    <small>추천 사용자의 페이지로·콜태그 결제 금액에서 20%가 정산됩니다.</small>
                  </div>
                  <button type="button" className="settings-secondary-button compact" onClick={copyPartnerCode} disabled={!referral.code}>
                    <Clipboard size={15} aria-hidden="true" /> 복사
                  </button>
                </div>
                <div className="settings-info-row">
                  <div>
                    <span>정산 상세</span>
                    <strong>콜태그 × 페이지로 통합 정산</strong>
                    <small>서비스별 수익, 확정 금액, 지급 내역을 확인합니다.</small>
                  </div>
                  <a className="settings-primary-button compact" href={SETTLEMENT_URL} target="_blank" rel="noreferrer">정산 보기</a>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </SettingsSection>
  );
}

import { Clipboard, RefreshCw, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
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

export default function PartnerSettingsSection({ authUser, openSection, setOpenSection }) {
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
    <SettingsSection
      id="partner"
      title="파트너"
      description="추천 코드와 수익 현황"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-partner-card"
    >
      <div className="account-partner-settings service-content-v2">
        <header className="account-finance-head service-content-head">
          <div>
            <UsersRound size={20} aria-hidden="true" />
            <div>
              <strong>파트너</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="파트너 정보 새로고침">
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}
        {notice && <p className="account-finance-message">{notice}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">파트너 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="partner-code-panel partner-code-v2">
              <div>
                <small>내 파트너 코드</small>
                <strong>{referral.code || '-'}</strong>
                <p>추천한 사용자의 페이지로·콜태그 결제 금액에서 20%가 정산됩니다.</p>
              </div>
              <button type="button" onClick={copyPartnerCode} disabled={!referral.code}>
                <Clipboard size={17} aria-hidden="true" /> 복사
              </button>
            </section>

            <section className="partner-metric-grid">
              <div><span><UsersRound size={16} />추천 가입</span><strong>{Number(referral.referralCount || 0)}명</strong></div>
              <div><span><TrendingUp size={16} />유료 전환</span><strong>{Number(referral.activePaidCount || 0)}명</strong></div>
              <div><span><WalletCards size={16} />이번 달 예상</span><strong>{money(settlement.estimatedRevenueKrw)}</strong></div>
              <div><span><WalletCards size={16} />누적 확정</span><strong>{money(settlement.confirmedRevenueKrw)}</strong></div>
            </section>

            <div className="service-footer-action">
              <span>정산 상세 내역은 통합 정산 페이지에서 확인할 수 있습니다.</span>
              <a href={SETTLEMENT_URL} target="_blank" rel="noreferrer">정산 보기</a>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

import { Clipboard, RefreshCw, UsersRound, WalletCards } from 'lucide-react';
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
      setNotice('복사하지 못했습니다. 코드를 직접 선택해 복사하세요.');
    }
  };

  return (
    <SettingsSection
      id="partner"
      title="파트너"
      description="파트너 코드와 수익 현황"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-partner-card"
    >
      <div className="account-partner-settings">
        <header className="account-finance-head">
          <div>
            <UsersRound size={20} aria-hidden="true" />
            <div>
              <strong>페이지로·콜태그 파트너</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}
        {notice && <p className="account-finance-message">{notice}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">파트너 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="partner-code-panel">
              <div>
                <span>내 파트너 코드</span>
                <strong>{referral.code || '-'}</strong>
                <small>추천받은 계정의 페이지로·콜태그 결제 금액에서 20%가 통합 정산됩니다.</small>
              </div>
              <button type="button" onClick={copyPartnerCode} disabled={!referral.code}>
                <Clipboard size={17} aria-hidden="true" /> 코드 복사
              </button>
            </section>

            <section className="partner-performance-panel">
              <header>
                <WalletCards size={19} aria-hidden="true" />
                <strong>파트너 실적</strong>
              </header>
              <dl>
                <div><dt>추천 가입</dt><dd>{Number(referral.referralCount || 0)}명</dd></div>
                <div><dt>유료 전환</dt><dd>{Number(referral.activePaidCount || 0)}명</dd></div>
                <div><dt>이번 달 예상</dt><dd>{money(settlement.estimatedRevenueKrw)}</dd></div>
                <div><dt>누적 확정</dt><dd>{money(settlement.confirmedRevenueKrw)}</dd></div>
              </dl>
              <a href={SETTLEMENT_URL} target="_blank" rel="noreferrer">정산 페이지 열기</a>
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

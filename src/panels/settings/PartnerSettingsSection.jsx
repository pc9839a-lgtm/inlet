import { Clipboard, RefreshCw } from 'lucide-react';
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
    <SettingsSection id="partner" className="settings-partner-card settings-flat-section">
      <div className="settings-flat-block">
        <div className="settings-flat-block-head">
          <strong>파트너</strong>
          <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> 새로고침
          </button>
        </div>

        {error && <p className="settings-message error" role="alert">{error}</p>}
        {notice && <p className="settings-message" role="status">{notice}</p>}

        {loading && !finance ? (
          <div className="settings-loading">불러오는 중</div>
        ) : (
          <div className="settings-compact-rows">
            <div className="settings-compact-row"><span>추천 가입</span><strong>{Number(referral.referralCount || 0)}명</strong><em /></div>
            <div className="settings-compact-row"><span>유료 전환</span><strong>{Number(referral.activePaidCount || 0)}명</strong><em /></div>
            <div className="settings-compact-row"><span>이번 달</span><strong>{money(settlement.estimatedRevenueKrw)}</strong><em /></div>
            <div className="settings-compact-row"><span>누적 확정</span><strong>{money(settlement.confirmedRevenueKrw)}</strong><em /></div>
            <div className="settings-compact-row settings-compact-row-action">
              <span>파트너 코드</span>
              <strong className="settings-mono-value">{referral.code || '-'}</strong>
              <button type="button" className="settings-secondary-button compact" onClick={copyPartnerCode} disabled={!referral.code}>
                <Clipboard size={14} aria-hidden="true" /> 복사
              </button>
            </div>
            <div className="settings-compact-row settings-compact-row-action">
              <span>정산</span>
              <strong>결제 금액의 20%</strong>
              <a className="settings-primary-button compact" href={SETTLEMENT_URL} target="_blank" rel="noreferrer">보기</a>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

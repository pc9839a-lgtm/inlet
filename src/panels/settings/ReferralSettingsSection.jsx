import { Clipboard, Gift, RefreshCw, UsersRound } from 'lucide-react';
import { useState } from 'react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

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

export default function ReferralSettingsSection({ authUser, openSection, setOpenSection }) {
  const { finance, loading, busy, error, notice, refresh, applyReferral, setNotice } = useAccountFinance(authUser);
  const [code, setCode] = useState('');
  const referral = finance?.referral || {};
  const settlement = finance?.settlement?.combined || {};

  const copyReferralCode = async () => {
    if (!referral.code) return;
    try {
      await copyText(referral.code);
      setNotice('추천인 코드를 복사했습니다.');
    } catch {
      setNotice('복사하지 못했습니다. 코드를 직접 선택해 복사하세요.');
    }
  };

  const submitReferral = async () => {
    const success = await applyReferral(code);
    if (success) setCode('');
  };

  return (
    <SettingsSection
      id="referral"
      title="추천인"
      description="추천 코드와 통합 정산"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-referral-card"
    >
      <div className="account-referral-settings">
        <header className="account-finance-head">
          <div>
            <Gift size={19} aria-hidden="true" />
            <div>
              <strong>추천인 프로그램</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}
        {notice && <p className="account-finance-message">{notice}</p>}

        {loading && !finance ? (
          <div className="account-finance-loading">추천 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="referral-code-panel">
              <div>
                <span>내 추천인 코드</span>
                <strong>{referral.code || '-'}</strong>
                <small>추천받은 계정 결제 금액의 20%가 페이지로·콜태그 통합 정산에 반영됩니다.</small>
              </div>
              <button type="button" onClick={copyReferralCode} disabled={!referral.code}>
                <Clipboard size={16} aria-hidden="true" /> 코드 복사
              </button>
            </section>

            <section className="referral-register-panel">
              <header>
                <div>
                  <strong>추천인 코드 등록</strong>
                  <small>첫 유료 결제 전, 계정당 한 번만 등록할 수 있습니다.</small>
                </div>
                {referral.locked && <span>등록 완료</span>}
              </header>

              {referral.locked ? (
                <div className="referral-registered-code">
                  <span>등록된 코드</span>
                  <strong>{referral.registeredCode}</strong>
                  <small>무료 이용 기간 +{Number(referral.bonusDays || 5)}일</small>
                </div>
              ) : (
                <div className="referral-code-entry">
                  <input
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="추천인 코드 입력"
                    maxLength={20}
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button type="button" onClick={submitReferral} disabled={!code || busy === 'referral'}>
                    {busy === 'referral' ? '등록 중' : '등록'}
                  </button>
                </div>
              )}
            </section>

            <section className="referral-performance-panel">
              <header>
                <UsersRound size={18} aria-hidden="true" />
                <strong>통합 추천 현황</strong>
              </header>
              <dl>
                <div><dt>추천 가입</dt><dd>{Number(referral.referralCount || 0)}명</dd></div>
                <div><dt>유료 전환</dt><dd>{Number(referral.activePaidCount || 0)}명</dd></div>
                <div><dt>이번 달 예상</dt><dd>{money(settlement.estimatedRevenueKrw)}</dd></div>
                <div><dt>누적 확정</dt><dd>{money(settlement.confirmedRevenueKrw)}</dd></div>
              </dl>
              <p>페이지로와 콜태그에서 발생한 추천 수익은 동일한 계정 원장으로 합산됩니다.</p>
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

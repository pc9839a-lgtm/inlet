import { CreditCard, RefreshCw, WalletCards } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

function money(value = 0) {
  return `${Math.max(0, Number(value || 0)).toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function ServicePlans({ finance, service, label, busy, onCheckout }) {
  const subscription = subscriptionFor(finance, service);
  const plans = finance?.pricing?.[service] || [];
  return (
    <section className="billing-service-panel">
      <header>
        <div>
          <strong>{label}</strong>
          <small>{subscription ? `${subscription.planName} 이용 중` : '결제된 요금제 없음'}</small>
        </div>
        <span>{subscription ? '이용 중' : '미결제'}</span>
      </header>

      <div className="billing-plan-list">
        {plans.map((plan) => {
          const current = subscription?.planCode === plan.code;
          const loading = busy === `${service}:${plan.code}`;
          return (
            <div className={`billing-plan-row ${current ? 'is-current' : ''}`} key={`${service}-${plan.code}`}>
              <div>
                <strong>{plan.name}</strong>
                <small>{plan.description}</small>
              </div>
              <b>{money(plan.amountKrw)}/월</b>
              <button
                type="button"
                disabled={current || loading}
                onClick={() => onCheckout(service, plan.code)}
              >
                {loading ? '이동 중' : current ? '현재 요금제' : '결제'}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function BillingSettingsSection({ authUser, openSection, setOpenSection }) {
  const { finance, loading, busy, error, refresh, checkout } = useAccountFinance(authUser);
  const settlement = finance?.settlement?.combined || {};
  const entitlement = finance?.entitlement || {};
  const trialDays = Number(entitlement?.trial?.remainingDays || 0);

  return (
    <SettingsSection
      id="billing"
      title="요금제·결제"
      description="페이지로와 콜태그 통합 결제"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-billing-card"
    >
      <div className="account-finance-settings">
        <header className="account-finance-head">
          <div>
            <CreditCard size={19} aria-hidden="true" />
            <div>
              <strong>통합 구독</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} aria-hidden="true" /> 새로고침
          </button>
        </header>

        <p className="account-finance-rule">
          같은 계정의 페이지로·콜태그 구독과 추천 수익은 하나의 서버 원장으로 관리됩니다.
          {trialDays > 0 ? ` 무료 이용 ${trialDays}일 남음.` : ''}
        </p>

        {error && <p className="account-finance-message is-error">{error}</p>}
        {loading && !finance ? (
          <div className="account-finance-loading">결제 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <div className="billing-service-grid">
              <ServicePlans finance={finance} service="pagero" label="페이지로" busy={busy} onCheckout={checkout} />
              <ServicePlans finance={finance} service="calltag" label="콜태그" busy={busy} onCheckout={checkout} />
            </div>

            <section className="billing-settlement-summary">
              <header>
                <WalletCards size={18} aria-hidden="true" />
                <strong>추천 정산 통합 현황</strong>
              </header>
              <dl>
                <div><dt>이번 달 예상</dt><dd>{money(settlement.estimatedRevenueKrw)}</dd></div>
                <div><dt>누적 확정</dt><dd>{money(settlement.confirmedRevenueKrw)}</dd></div>
                <div><dt>추천 가입</dt><dd>{Number(settlement.referredCount || 0)}명</dd></div>
                <div><dt>유료 전환</dt><dd>{Number(settlement.activePaidCount || 0)}명</dd></div>
              </dl>
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

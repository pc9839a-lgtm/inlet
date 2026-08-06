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
          <small>{subscription?.status === 'active' ? `${subscription.planName} 이용 중` : '결제된 요금제 없음'}</small>
        </div>
        <span>{subscription?.status === 'active' ? '이용 중' : '미결제'}</span>
      </header>

      <div className="billing-plan-list">
        {plans.map((plan) => {
          const current = subscription?.status === 'active' && subscription?.planCode === plan.code;
          const loading = busy === `${service}:${plan.code}`;
          return (
            <div className={`billing-plan-row ${current ? 'is-current' : ''}`} key={`${service}-${plan.code}`}>
              <div>
                <strong>{plan.name}</strong>
                <small>{plan.description}</small>
              </div>
              <b>{plan.amountKrw ? `${money(plan.amountKrw)}/월` : '무료'}</b>
              {plan.code === 'free' ? (
                <span className="billing-plan-free">기본</span>
              ) : (
                <button
                  type="button"
                  disabled={current || loading}
                  onClick={() => onCheckout(service, plan.code)}
                >
                  {loading ? '이동 중' : current ? '현재 요금제' : '결제'}
                </button>
              )}
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

        <p className="account-finance-rule">같은 계정의 페이지로·콜태그 결제와 추천 정산은 하나의 원장으로 합산됩니다.</p>

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
                <strong>통합 정산</strong>
              </header>
              <dl>
                <div><dt>누적 수익</dt><dd>{money(settlement.earned)}</dd></div>
                <div><dt>정산 대기</dt><dd>{money(settlement.pending)}</dd></div>
                <div><dt>정산 가능</dt><dd>{money(settlement.available)}</dd></div>
                <div><dt>지급 완료</dt><dd>{money(settlement.paid)}</dd></div>
              </dl>
              <div className="billing-service-totals">
                <span>페이지로 {money(finance?.settlement?.byService?.pagero?.earned)}</span>
                <span>콜태그 {money(finance?.settlement?.byService?.calltag?.earned)}</span>
              </div>
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

import { CreditCard, RefreshCw } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '무료' : `${amount.toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function ServicePlans({ finance, service, label, busy, onCheckout }) {
  const subscription = subscriptionFor(finance, service);
  const plans = finance?.pricing?.[service] || [];
  const freeCurrent = service === 'pagero' && !subscription;
  const domainIncluded = service === 'domain' && finance?.domain?.includedByPlan === true;
  const domainActive = service === 'domain' && finance?.domain?.enabled === true;
  const currentLabel = domainIncluded
    ? '프로 요금제에 1개 포함'
    : subscription
      ? `${subscription.planName} 이용 중`
      : freeCurrent ? '무료 요금제 이용 중' : '결제된 요금제 없음';
  const serviceActive = subscription || freeCurrent || domainActive;

  return (
    <section className="billing-service-panel">
      <header>
        <div>
          <strong>{label}</strong>
          <small>{currentLabel}</small>
        </div>
        <span>{serviceActive ? '이용 중' : '미결제'}</span>
      </header>

      <div className="billing-plan-list">
        {plans.map((plan) => {
          const current = domainIncluded
            ? true
            : plan.included ? freeCurrent : subscription?.planCode === plan.code;
          const loading = busy === `${service}:${plan.code}`;
          return (
            <div className={`billing-plan-row ${current ? 'is-current' : ''}`} key={`${service}-${plan.code}`}>
              <div>
                <strong>{plan.name}</strong>
                <small>{plan.description}</small>
              </div>
              <b>{domainIncluded ? '프로 포함' : `${money(plan.amountKrw)}${plan.amountKrw > 0 ? '/월' : ''}`}</b>
              <button
                type="button"
                disabled={current || loading || plan.included}
                onClick={() => onCheckout(service, plan.code)}
              >
                {loading ? '이동 중' : domainIncluded ? '프로 포함' : plan.included ? '기본 제공' : current ? '현재 이용 중' : '결제'}
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

  return (
    <SettingsSection
      id="billing"
      title="요금제·결제"
      description="페이지로, 개인 도메인, 콜태그 요금제"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-billing-card"
    >
      <div className="account-finance-settings">
        <header className="account-finance-head">
          <div>
            <CreditCard size={20} aria-hidden="true" />
            <div>
              <strong>요금제·결제</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> 새로고침
          </button>
        </header>

        <p className="account-finance-rule">프로는 개인 도메인 1개와 HTTPS/SSL 관리가 포함됩니다. 무료·클래식은 개인 도메인을 월 1,000원에 추가할 수 있습니다.</p>

        {error && <p className="account-finance-message is-error">{error}</p>}
        {loading && !finance ? (
          <div className="account-finance-loading">결제 정보를 불러오는 중입니다.</div>
        ) : (
          <div className="billing-service-grid">
            <ServicePlans finance={finance} service="pagero" label="페이지로" busy={busy} onCheckout={checkout} />
            <ServicePlans finance={finance} service="domain" label="개인 도메인·HTTPS" busy={busy} onCheckout={checkout} />
            <ServicePlans finance={finance} service="calltag" label="콜태그" busy={busy} onCheckout={checkout} />
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

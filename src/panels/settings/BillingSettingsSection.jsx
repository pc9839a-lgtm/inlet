import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';
import './BillingSettingsSection.css';

const FALLBACK_PLANS = [
  { code: 'pagero_free', name: '무료', amountKrw: 0 },
  { code: 'pagero_monthly', name: '클래식', amountKrw: 3500 },
  { code: 'pagero_pro_monthly', name: '프로', amountKrw: 5500 },
];


function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '0원' : `${amount.toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function PlanCard({ plan, current, busy, onClick }) {
  const active = current;
  const paid = Number(plan.amountKrw || 0) > 0;
  const recommended = plan.code === 'pagero_monthly';

  return (
    <article className={`billing-plan-card ${active ? 'is-current' : ''} ${recommended ? 'is-recommended' : ''}`}>
      <div className="billing-plan-card-top">
        <div className="billing-plan-badges">
          {recommended && <span className="recommended">추천</span>}
          {active && <span className="current">현재</span>}
        </div>
        <strong className="billing-plan-name">{plan.name}</strong>
        <div className="billing-plan-price">
          <b>{money(plan.amountKrw)}</b>
          {paid && <span>/월</span>}
        </div>
      </div>


      <button
        type="button"
        className={`billing-plan-action ${active ? 'is-current' : ''}`}
        disabled={!paid || active || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : active ? '이용 중' : paid ? '가입 문의' : '기본'}
      </button>
    </article>
  );
}

export default function BillingSettingsSection({ authUser }) {
  const { finance, loading, busy, error, checkout } = useAccountFinance(authUser);
  const pageroSubscription = subscriptionFor(finance, 'pagero');
  const plans = finance?.pricing?.pagero?.length ? finance.pricing.pagero : FALLBACK_PLANS;
  const currentCode = pageroSubscription?.planCode || 'pagero_free';

  return (
    <SettingsSection id="billing" className="settings-billing-section billing-settings-v7">
      <div className="billing-settings-head">
        <div>
          <strong>페이지로 요금제</strong>
        </div>
      </div>

      <div className="billing-settings-status" role="status">
        <span>자동결제</span><strong>준비 중</strong>
        <span>유료 플랜</span><strong>가입 문의</strong>
      </div>
      {error && <p className="settings-message error" role="alert">{error}</p>}
      {loading && !finance ? <div className="settings-loading">요금제 확인 중</div> : null}

      <div className="billing-plan-grid" aria-label="페이지로 요금제">
        {plans.slice(0, 3).map((plan) => {
          const current = currentCode === plan.code;
          return (
            <PlanCard
              key={plan.code}
              plan={plan}
              current={current}
              busy={busy === `pagero:${plan.code}`}
              onClick={() => checkout('pagero', plan.code)}
            />
          );
        })}
      </div>

    </SettingsSection>
  );
}

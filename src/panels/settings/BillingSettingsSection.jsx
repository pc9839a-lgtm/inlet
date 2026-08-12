import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

const FALLBACK_PLANS = [
  { code: 'pagero_free', name: '무료', amountKrw: 0 },
  { code: 'pagero_monthly', name: '클래식', amountKrw: 3500 },
  { code: 'pagero_pro_monthly', name: '프로', amountKrw: 5500 },
];

const PLAN_FEATURES = {
  pagero_free: ['페이지 제작·공개', '기본 편집·스타일', '문의 접수'],
  pagero_monthly: ['무료 기능 전체', '접수함·통계', '운영 기능 확장'],
  pagero_pro_monthly: ['클래식 기능 전체', '고급 연동', 'HTTPS·SSL 포함'],
};

function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '0원' : `${amount.toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function PlanCard({ plan, current, included, busy, onClick }) {
  const features = PLAN_FEATURES[plan.code] || [plan.description].filter(Boolean);
  const paid = Number(plan.amountKrw || 0) > 0;

  return (
    <article
      className={`billing-tier-card ${current || included ? 'is-current' : ''}`}
      style={{ minHeight: '320px', padding: '22px 18px' }}
    >
      <div className="billing-tier-head">
        <div>
          <strong>{plan.name}</strong>
          {(current || included) && <span className="billing-tier-current">현재</span>}
        </div>
        <p><b>{money(plan.amountKrw)}</b>{paid && <span>/월</span>}</p>
      </div>

      <ul className="billing-tier-features">
        {features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>

      <button
        type="button"
        className={current || included ? 'settings-secondary-button' : 'settings-primary-button'}
        disabled={!paid || current || included || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : current || included ? '이용 중' : paid ? '이 요금제 선택' : '기본 요금제'}
      </button>
    </article>
  );
}

export default function BillingSettingsSection({ authUser }) {
  const { finance, loading, busy, error, checkout } = useAccountFinance(authUser);
  const pageroSubscription = subscriptionFor(finance, 'pagero');
  const bundleClassic = finance?.pagero?.includedClassicByBundle === true;
  const plans = finance?.pricing?.pagero?.length ? finance.pricing.pagero : FALLBACK_PLANS;
  const currentCode = bundleClassic ? 'pagero_monthly' : pageroSubscription?.planCode || 'pagero_free';

  return (
    <SettingsSection id="billing" className="settings-billing-section billing-tier-section">
      <div className="billing-tier-intro">
        <strong>페이지로 요금제</strong>
        <span>필요한 기능에 맞춰 선택하세요.</span>
      </div>

      {error && <p className="settings-message error" role="alert">{error}</p>}
      {loading && !finance ? <div className="settings-loading">요금제 확인 중</div> : null}

      <div className="billing-tier-grid" aria-label="페이지로 요금제">
        {plans.slice(0, 3).map((plan) => {
          const included = bundleClassic && plan.code === 'pagero_monthly';
          const current = currentCode === plan.code;
          return (
            <PlanCard
              key={plan.code}
              plan={plan}
              current={current}
              included={included}
              busy={busy === `pagero:${plan.code}`}
              onClick={() => checkout('pagero', plan.code)}
            />
          );
        })}
      </div>
    </SettingsSection>
  );
}

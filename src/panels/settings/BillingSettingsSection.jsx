import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';
import './BillingSettingsSection.css';

const DOMAIN_PRODUCT = 'pagero_domain_monthly';

const FALLBACK_PLANS = [
  { code: 'pagero_free', name: '무료', amountKrw: 0 },
  { code: 'pagero_monthly', name: '클래식', amountKrw: 3500 },
  { code: 'pagero_pro_monthly', name: '프로', amountKrw: 5500 },
];

const PLAN_CONTENT = {
  pagero_free: {
    badge: '기본',
    features: ['페이지 제작·공개', '문의 접수'],
  },
  pagero_monthly: {
    badge: '추천',
    features: ['접수함 문의 관리', '유입·전환 통계'],
  },
  pagero_pro_monthly: {
    badge: '고급',
    features: ['고급 연동', 'HTTPS·SSL 포함'],
  },
};

function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '0원' : `${amount.toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function PlanCard({ plan, current, included, busy, onClick }) {
  const content = PLAN_CONTENT[plan.code] || {
    badge: '',
    features: [plan.description].filter(Boolean),
  };
  const active = current || included;
  const paid = Number(plan.amountKrw || 0) > 0;
  const recommended = plan.code === 'pagero_monthly';

  return (
    <article className={`billing-plan-card ${active ? 'is-current' : ''} ${recommended ? 'is-recommended' : ''}`}>
      <div className="billing-plan-card-top">
        <div className="billing-plan-badges">
          {content.badge && <span className={recommended ? 'recommended' : ''}>{content.badge}</span>}
          {active && <span className="current">현재</span>}
        </div>
        <strong className="billing-plan-name">{plan.name}</strong>
        <div className="billing-plan-price">
          <b>{money(plan.amountKrw)}</b>
          {paid && <span>/월</span>}
        </div>
      </div>

      <ul className="billing-plan-features">
        {content.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>

      <button
        type="button"
        className={`billing-plan-action ${active ? 'is-current' : ''}`}
        disabled={!paid || active || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : active ? '이용 중' : paid ? `${plan.name} 선택` : '기본'}
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
  const sslEnabled = finance?.domain?.enabled === true;
  const sslIncludedByPlan = finance?.domain?.includedByPlan === true || currentCode === 'pagero_pro_monthly';
  const sslBusy = busy === `domain:${DOMAIN_PRODUCT}`;

  return (
    <SettingsSection id="billing" className="settings-billing-section billing-settings-v7">
      <div className="billing-settings-head">
        <strong>페이지로 요금제</strong>
      </div>

      {error && <p className="settings-message error" role="alert">{error}</p>}
      {loading && !finance ? <div className="settings-loading">요금제 확인 중</div> : null}

      <div className="billing-plan-grid" aria-label="페이지로 요금제">
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

      <div className="billing-addon-head">
        <strong>추가 서비스</strong>
      </div>

      <article className="billing-addon-row">
        <div className="billing-addon-name">
          <strong>HTTPS · SSL</strong>
          <span>{sslIncludedByPlan ? '프로 포함' : sslEnabled ? '이용 중' : '1,000원/월'}</span>
        </div>
        <div className="billing-addon-value">
          <strong>{sslIncludedByPlan ? '포함' : sslEnabled ? '적용 중' : '미적용'}</strong>
        </div>
        <button
          type="button"
          className="billing-plan-action billing-addon-action"
          disabled={sslEnabled || sslIncludedByPlan || sslBusy}
          onClick={() => checkout('domain', DOMAIN_PRODUCT)}
        >
          {sslBusy ? '이동 중' : sslEnabled || sslIncludedByPlan ? '적용 중' : '신청'}
        </button>
      </article>
    </SettingsSection>
  );
}

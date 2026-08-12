import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';
import './BillingSettingsSection.css';

const FALLBACK_PLANS = [
  { code: 'pagero_free', name: '무료', amountKrw: 0 },
  { code: 'pagero_monthly', name: '클래식', amountKrw: 3500 },
  { code: 'pagero_pro_monthly', name: '프로', amountKrw: 5500 },
];

const PLAN_CONTENT = {
  pagero_free: {
    eyebrow: '가볍게 시작',
    pitch: '페이지를 만들고 문의를 받아보는 기본 단계',
    target: '처음 페이지를 만들거나 기능을 먼저 확인할 때',
    features: ['페이지 제작·공개', '기본 편집·스타일', '문의 접수'],
  },
  pagero_monthly: {
    eyebrow: '가장 추천',
    pitch: '접수와 통계를 한곳에서 관리하는 실전 운영 단계',
    target: '문의가 들어오기 시작했고 운영 흐름을 놓치고 싶지 않을 때',
    features: ['무료 기능 전체', '접수함에서 문의 관리', '통계로 유입·전환 확인', '운영 기능 확장'],
  },
  pagero_pro_monthly: {
    eyebrow: '운영 고도화',
    pitch: '연동과 보안까지 갖춘 비즈니스 운영 단계',
    target: '페이지를 본격적으로 운영하고 연동·HTTPS까지 한 번에 관리할 때',
    features: ['클래식 기능 전체', '고급 연동', 'HTTPS·SSL 포함', '운영 환경 고도화'],
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
    eyebrow: '',
    pitch: plan.description || '',
    target: '',
    features: [plan.description].filter(Boolean),
  };
  const paid = Number(plan.amountKrw || 0) > 0;
  const active = current || included;
  const recommended = plan.code === 'pagero_monthly';

  return (
    <article className={`billing-plan-v5-card ${active ? 'is-current' : ''} ${recommended ? 'is-recommended' : ''}`}>
      <header className="billing-plan-v5-head">
        <div className="billing-plan-v5-topline">
          <span className="billing-plan-v5-eyebrow">{content.eyebrow}</span>
          {active && <span className="billing-plan-v5-current">현재</span>}
        </div>
        <div className="billing-plan-v5-name-row">
          <strong>{plan.name}</strong>
        </div>
        <div className="billing-plan-v5-price">
          <b>{money(plan.amountKrw)}</b>
          {paid && <span>/월</span>}
        </div>
        <p className="billing-plan-v5-pitch">{content.pitch}</p>
      </header>

      <div className="billing-plan-v5-value">
        <span>이런 경우 추천</span>
        <strong>{content.target}</strong>
      </div>

      <ul className="billing-plan-v5-features">
        {content.features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>

      <button
        type="button"
        className={`billing-plan-v5-action ${active ? 'is-current' : ''}`}
        disabled={!paid || active || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : active ? '이용 중' : paid ? `${plan.name} 시작하기` : '무료로 이용 중'}
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
    <SettingsSection id="billing" className="settings-billing-section billing-plan-v5-section">
      <div className="billing-plan-v5-intro">
        <div>
          <strong>페이지로 요금제</strong>
          <span>무료로 시작하고, 운영이 필요해질 때 업그레이드하세요.</span>
        </div>
        <em>대부분의 운영 페이지에는 클래식을 추천합니다.</em>
      </div>

      {error && <p className="settings-message error" role="alert">{error}</p>}
      {loading && !finance ? <div className="settings-loading">요금제 확인 중</div> : null}

      <div className="billing-plan-v5-grid" aria-label="페이지로 요금제">
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

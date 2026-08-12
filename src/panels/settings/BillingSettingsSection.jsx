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
    pitch: '페이지를 만들고 문의를 받는 기본 단계',
    why: '처음 페이지를 만들거나 기능을 먼저 확인할 때',
    features: ['페이지 제작·공개', '기본 편집·스타일', '문의 접수'],
  },
  pagero_monthly: {
    badge: '추천',
    pitch: '문의가 들어오기 시작하면 필요한 실전 운영 단계',
    why: '접수함에서 문의를 관리하고 유입·전환 통계를 확인할 때',
    features: ['무료 기능 전체', '접수함 문의 관리', '유입·전환 통계', '운영 기능 확장'],
  },
  pagero_pro_monthly: {
    badge: '고급',
    pitch: '연동과 HTTPS까지 필요한 고급 운영 단계',
    why: '페이지를 본격적으로 운영하고 보안·연동까지 한 번에 관리할 때',
    features: ['클래식 기능 전체', '고급 연동', 'HTTPS·SSL 포함', '고급 운영 기능'],
  },
};

function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '0원' : `${amount.toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function PlanRow({ plan, current, included, busy, onClick }) {
  const content = PLAN_CONTENT[plan.code] || {
    badge: '',
    pitch: plan.description || '',
    why: '',
    features: [plan.description].filter(Boolean),
  };
  const active = current || included;
  const paid = Number(plan.amountKrw || 0) > 0;
  const recommended = plan.code === 'pagero_monthly';

  return (
    <article className={`billing-plan-row ${active ? 'is-current' : ''} ${recommended ? 'is-recommended' : ''}`}>
      <div className="billing-plan-row-main">
        <div className="billing-plan-row-name">
          <div>
            <strong>{plan.name}</strong>
            {content.badge && <span className={recommended ? 'recommended' : ''}>{content.badge}</span>}
            {active && <span className="current">현재</span>}
          </div>
          <p><b>{money(plan.amountKrw)}</b>{paid && <em>/월</em>}</p>
        </div>

        <div className="billing-plan-row-value">
          <strong>{content.pitch}</strong>
          <span>{content.why}</span>
        </div>

        <ul className="billing-plan-row-features">
          {content.features.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
      </div>

      <button
        type="button"
        className={`billing-plan-row-action ${active ? 'is-current' : ''}`}
        disabled={!paid || active || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : active ? '이용 중' : paid ? '변경' : '기본'}
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
    <SettingsSection id="billing" className="settings-billing-section billing-settings-v6">
      <div className="billing-settings-head">
        <div>
          <strong>페이지로 요금제</strong>
          <span>무료 → 클래식 → 프로 순서로 운영 기능이 확장됩니다.</span>
        </div>
      </div>

      {error && <p className="settings-message error" role="alert">{error}</p>}
      {loading && !finance ? <div className="settings-loading">요금제 확인 중</div> : null}

      <div className="billing-plan-list" aria-label="페이지로 요금제">
        {plans.slice(0, 3).map((plan) => {
          const included = bundleClassic && plan.code === 'pagero_monthly';
          const current = currentCode === plan.code;
          return (
            <PlanRow
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
          <strong>직접 설정 없이 HTTPS를 관리합니다.</strong>
          <span>프로 요금제에는 SSL 관리가 기본 포함됩니다.</span>
        </div>
        <button
          type="button"
          className="billing-plan-row-action"
          disabled={sslEnabled || sslIncludedByPlan || sslBusy}
          onClick={() => checkout('domain', DOMAIN_PRODUCT)}
        >
          {sslBusy ? '이동 중' : sslEnabled || sslIncludedByPlan ? '적용 중' : '신청'}
        </button>
      </article>
    </SettingsSection>
  );
}

import { CreditCard, Globe2, PhoneCall, RefreshCw, ShieldCheck } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '무료' : `${amount.toLocaleString('ko-KR')}원`;
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

const SERVICE_META = {
  pagero: { label: '페이지로', icon: Globe2, subtitle: '랜딩페이지 제작·운영' },
  calltag: { label: '콜태그', icon: PhoneCall, subtitle: '페이지로 클래식 + 전화관리 + 문자자동화' },
  domain: { label: 'HTTPS · SSL', icon: ShieldCheck, subtitle: '도메인 연결은 무료 · HTTPS 관리만 유료' },
};

function ServicePlans({ finance, service, busy, onCheckout }) {
  const subscription = subscriptionFor(finance, service);
  const plans = finance?.pricing?.[service] || [];
  const bundleActive = finance?.calltag?.bundleActive === true;
  const bundleClassic = service === 'pagero' && finance?.pagero?.includedClassicByBundle === true;
  const calltagActiveCodes = new Set(finance?.calltag?.activePlanCodes || []);
  const freeCurrent = service === 'pagero' && !subscription && !bundleClassic;
  const sslIncluded = service === 'domain' && finance?.domain?.includedByPlan === true;
  const sslActive = service === 'domain' && finance?.domain?.enabled === true;
  const serviceActive = Boolean(subscription || freeCurrent || sslActive || bundleClassic || (service === 'calltag' && calltagActiveCodes.size));
  const MetaIcon = SERVICE_META[service].icon;

  let currentLabel = service === 'domain' ? '미신청' : freeCurrent ? '무료 이용 중' : '미이용';
  if (sslIncluded) currentLabel = '프로 포함';
  else if (bundleClassic) currentLabel = '통합권 포함';
  else if (service === 'calltag' && bundleActive) currentLabel = '통합권 이용 중';
  else if (service === 'calltag' && calltagActiveCodes.has('call_monthly') && calltagActiveCodes.has('message_monthly')) currentLabel = '앱 이용 중';
  else if (subscription) currentLabel = `${subscription.planName} 이용 중`;

  return (
    <section className={`service-plan-card service-${service}`}>
      <header className="service-plan-card-head">
        <div className="service-plan-title">
          <span className="service-plan-icon"><MetaIcon size={22} aria-hidden="true" /></span>
          <div>
            <strong>{SERVICE_META[service].label}</strong>
            <small>{SERVICE_META[service].subtitle}</small>
          </div>
        </div>
        <span className={`service-state ${serviceActive ? 'active' : ''}`}>{currentLabel}</span>
      </header>

      <div className="service-plan-options">
        {plans.map((plan) => {
          const pageroIncludedByBundle = service === 'pagero' && bundleClassic && plan.code === 'pagero_monthly';
          const current = sslIncluded
            ? true
            : service === 'calltag'
              ? calltagActiveCodes.has(plan.code)
              : pageroIncludedByBundle
                ? true
                : plan.included ? freeCurrent : subscription?.planCode === plan.code;
          const loading = busy === `${service}:${plan.code}`;
          const title = service === 'domain' ? 'SSL 관리' : plan.name;
          const description = service === 'domain'
            ? '인증서 발급 · 자동 갱신 · HTTPS 적용'
            : plan.description;
          const included = pageroIncludedByBundle;
          const featured = service === 'calltag' && plan.code === 'all_monthly';

          return (
            <div
              className={`service-plan-option plan-${plan.code}${current || included ? ' is-current' : ''}${featured ? ' is-featured' : ''}`}
              key={`${service}-${plan.code}`}
            >
              <div className="service-plan-copy">
                <div className="service-plan-name-row">
                  <strong>{title}</strong>
                  {featured && <span className="service-recommend-badge">통합</span>}
                  {current && !included && <span>현재</span>}
                  {included && <span>포함</span>}
                </div>
                {featured ? (
                  <div className="service-bundle-includes" aria-label="통합권 포함 서비스">
                    <span>페이지로 클래식</span>
                    <span>전화관리</span>
                    <span>문자자동화</span>
                  </div>
                ) : (
                  <small>{description}</small>
                )}
              </div>
              <div className="service-plan-action">
                <b>{sslIncluded ? '포함' : money(plan.amountKrw)}{!sslIncluded && plan.amountKrw > 0 ? <em>/월</em> : null}</b>
                <button
                  type="button"
                  disabled={current || included || loading || plan.included}
                  onClick={() => onCheckout(service, plan.code)}
                >
                  {loading ? '이동 중' : included ? '통합권 포함' : current ? '이용 중' : plan.included ? '기본 제공' : service === 'domain' ? 'SSL 신청' : '이용하기'}
                </button>
              </div>
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
      description="서비스 이용 현황과 결제"
      openSection={openSection}
      setOpenSection={setOpenSection}
      className="settings-billing-card"
    >
      <div className="account-finance-settings service-content-v2">
        <header className="account-finance-head service-content-head">
          <div>
            <CreditCard size={22} aria-hidden="true" />
            <div>
              <strong>서비스 이용 현황</strong>
              <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={loading} aria-label="결제 정보 새로고침">
            <RefreshCw size={17} aria-hidden="true" /> 새로고침
          </button>
        </header>

        {error && <p className="account-finance-message is-error">{error}</p>}
        {loading && !finance ? (
          <div className="account-finance-loading">결제 정보를 불러오는 중입니다.</div>
        ) : (
          <div className="billing-service-grid service-card-grid">
            <ServicePlans finance={finance} service="pagero" busy={busy} onCheckout={checkout} />
            <ServicePlans finance={finance} service="calltag" busy={busy} onCheckout={checkout} />
            <ServicePlans finance={finance} service="domain" busy={busy} onCheckout={checkout} />
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

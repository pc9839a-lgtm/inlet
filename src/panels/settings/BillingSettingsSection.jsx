import { RefreshCw } from 'lucide-react';
import SettingsSection from './SettingsSection.jsx';
import useAccountFinance from './useAccountFinance.js';

function money(value = 0) {
  const amount = Math.max(0, Number(value || 0));
  return amount === 0 ? '무료' : `${amount.toLocaleString('ko-KR')}원`;
}

function dateLabel(value = '') {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) return '-';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(parsed));
}

function statusLabel(value = '') {
  const labels = {
    active: '이용 중',
    grace: '유예 중',
    cancelled: '해지 예정',
    expired: '만료',
    suspended: '중지',
    refunded: '환불',
    pending: '확인 중',
  };
  return labels[String(value || '').toLowerCase()] || '확인 중';
}

function channelLabel(value = '') {
  const labels = { web: '웹', google_play: 'Google Play', mixed: '통합' };
  return labels[String(value || '').toLowerCase()] || '-';
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function PlanRow({ name, price, current, included, busy, onClick, badge = '' }) {
  return (
    <div className={`billing-plan-row ${current || included ? 'current' : ''}`}>
      <div className="billing-plan-copy">
        <div className="billing-plan-title-line">
          <strong>{name}</strong>
          {badge && <span className="settings-status-badge dark">{badge}</span>}
          {current && <span className="settings-status-badge success">이용 중</span>}
          {included && <span className="settings-status-badge success">포함</span>}
        </div>
      </div>
      <div className="billing-plan-price">
        <b>{price}</b>
        {price !== '무료' && price !== '포함' && <span>/월</span>}
      </div>
      <button
        type="button"
        className={current || included ? 'settings-secondary-button compact' : 'settings-primary-button compact'}
        disabled={current || included || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : current ? '현재' : included ? '포함' : '변경'}
      </button>
    </div>
  );
}

export default function BillingSettingsSection({ authUser }) {
  const { finance, loading, busy, error, refresh, checkout } = useAccountFinance(authUser);
  const pageroSubscription = subscriptionFor(finance, 'pagero');
  const calltagSubscription = subscriptionFor(finance, 'calltag');
  const pageroPlans = finance?.pricing?.pagero || [];
  const calltagBundle = (finance?.pricing?.calltag || []).find((plan) => plan.code === 'all_monthly');
  const bundleActive = finance?.calltag?.bundleActive === true;
  const bundleClassic = finance?.pagero?.includedClassicByBundle === true;
  const sslEnabled = finance?.domain?.enabled === true;
  const sslIncluded = finance?.domain?.includedByPlan === true;
  const history = (finance?.subscriptionHistory || []).slice(0, 6);

  const isPageroCurrent = (plan) => {
    if (bundleClassic && plan.code === 'pagero_monthly') return true;
    if (plan.included && !pageroSubscription && !bundleClassic) return true;
    return pageroSubscription?.planCode === plan.code;
  };

  return (
    <SettingsSection id="billing" className="settings-billing-section settings-flat-section">
      <div className="settings-flat-block">
        <div className="settings-flat-block-head">
          <strong>현재 이용</strong>
          <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} aria-hidden="true" /> 새로고침
          </button>
        </div>
        <div className="settings-compact-rows">
          <div className="settings-compact-row"><span>페이지로</span><strong>{bundleClassic ? '클래식 · 통합권 포함' : pageroSubscription?.planName || '무료'}</strong><em>{pageroSubscription?.nextBillingAt ? dateLabel(pageroSubscription.nextBillingAt) : '-'}</em></div>
          <div className="settings-compact-row"><span>콜태그</span><strong>{bundleActive ? '통합권' : '미이용'}</strong><em>{calltagSubscription?.nextBillingAt ? dateLabel(calltagSubscription.nextBillingAt) : '-'}</em></div>
          <div className="settings-compact-row"><span>SSL</span><strong>{sslIncluded ? '프로 포함' : sslEnabled ? '이용 중' : '미이용'}</strong><em>{sslIncluded ? '포함' : sslEnabled ? '1,000원/월' : '-'}</em></div>
        </div>
      </div>

      {error && <p className="settings-message error" role="alert">{error}</p>}

      {loading && !finance ? (
        <div className="settings-loading">불러오는 중</div>
      ) : (
        <>
          <div className="settings-flat-block">
            <div className="settings-flat-block-head"><strong>페이지로 요금제</strong></div>
            <div className="billing-plan-list">
              {pageroPlans.map((plan) => {
                const included = bundleClassic && plan.code === 'pagero_monthly';
                const current = isPageroCurrent(plan);
                return (
                  <PlanRow
                    key={plan.code}
                    name={plan.name}
                    price={money(plan.amountKrw)}
                    current={current && !included}
                    included={included}
                    busy={busy === `pagero:${plan.code}`}
                    onClick={() => checkout('pagero', plan.code)}
                  />
                );
              })}
            </div>
          </div>

          <div className="settings-flat-block">
            <div className="settings-flat-block-head"><strong>콜태그 통합권</strong></div>
            <div className="billing-plan-list">
              <PlanRow
                name="통합권"
                price={money(calltagBundle?.amountKrw || 6000)}
                current={bundleActive}
                busy={busy === 'calltag:all_monthly'}
                onClick={() => checkout('calltag', 'all_monthly')}
                badge="페이지로 클래식 · 전화관리 · 문자자동화"
              />
            </div>
          </div>

          <div className="settings-flat-block settings-flat-row">
            <div><strong>SSL 관리</strong><span className="settings-flat-value">{sslIncluded ? '프로 포함' : '1,000원/월'}</span></div>
            <button
              type="button"
              className={sslEnabled || sslIncluded ? 'settings-secondary-button compact' : 'settings-primary-button compact'}
              disabled={sslEnabled || sslIncluded || busy === 'domain:pagero_domain_monthly'}
              onClick={() => checkout('domain', 'pagero_domain_monthly')}
            >
              {sslIncluded ? '포함' : sslEnabled ? '이용 중' : '신청'}
            </button>
          </div>

          <div className="settings-flat-block">
            <div className="settings-flat-block-head"><strong>최근 구독</strong></div>
            {history.length ? (
              <div className="billing-history-list" role="table" aria-label="최근 구독 기록">
                <div className="billing-history-head" role="row">
                  <span role="columnheader">상품</span>
                  <span role="columnheader">채널</span>
                  <span role="columnheader">상태</span>
                  <span role="columnheader">다음 결제/만료</span>
                </div>
                {history.map((item) => (
                  <div className="billing-history-row" role="row" key={`${item.id}-${item.updatedAt}`}>
                    <strong role="cell">{item.planName}</strong>
                    <span role="cell">{channelLabel(item.channel)}</span>
                    <span role="cell">{statusLabel(item.status)}</span>
                    <span role="cell">{dateLabel(item.nextBillingAt || item.expiresAt)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-empty-copy">구독 기록 없음</p>
            )}
          </div>
        </>
      )}
    </SettingsSection>
  );
}

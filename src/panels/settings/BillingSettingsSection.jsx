import { CreditCard, RefreshCw, ShieldCheck } from 'lucide-react';
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
  const labels = { web: '웹 결제', google_play: 'Google Play', mixed: '통합' };
  return labels[String(value || '').toLowerCase()] || '결제 채널';
}

function subscriptionFor(finance, service) {
  return (finance?.subscriptions || []).find((item) => item.service === service) || null;
}

function PlanRow({ name, description, price, current, included, busy, onClick, badge = '' }) {
  return (
    <div className={`billing-plan-row ${current || included ? 'current' : ''}`}>
      <div className="billing-plan-copy">
        <div className="billing-plan-title-line">
          <strong>{name}</strong>
          {badge && <span className="settings-status-badge dark">{badge}</span>}
          {current && <span className="settings-status-badge success">이용 중</span>}
          {included && <span className="settings-status-badge success">포함</span>}
        </div>
        <small>{description}</small>
      </div>
      <div className="billing-plan-price">
        <b>{price}</b>
        {price !== '무료' && price !== '포함' && <span>/월</span>}
      </div>
      <button
        type="button"
        className={current || included ? 'settings-secondary-button' : 'settings-primary-button'}
        disabled={current || included || busy}
        onClick={onClick}
      >
        {busy ? '이동 중' : current ? '현재 요금제' : included ? '통합권 포함' : '변경'}
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
    <SettingsSection id="billing" className="settings-billing-section">
      <div className="settings-stack">
        <section className="settings-surface billing-summary-surface">
          <div className="settings-surface-head">
            <div className="settings-icon-title">
              <span className="settings-icon-box"><CreditCard size={19} aria-hidden="true" /></span>
              <div>
                <strong>현재 이용 상태</strong>
                <small>{finance?.account?.email || authUser?.email || '현재 계정'}</small>
              </div>
            </div>
            <button type="button" className="settings-secondary-button compact" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} aria-hidden="true" /> 새로고침
            </button>
          </div>

          <div className="billing-current-grid">
            <div>
              <span>페이지로</span>
              <strong>{bundleClassic ? '클래식 · 통합권 포함' : pageroSubscription?.planName || '무료'}</strong>
              <small>{pageroSubscription?.nextBillingAt ? `다음 결제 ${dateLabel(pageroSubscription.nextBillingAt)}` : '별도 결제 일정 없음'}</small>
            </div>
            <div>
              <span>콜태그</span>
              <strong>{bundleActive ? '통합권 이용 중' : '미이용'}</strong>
              <small>{calltagSubscription?.nextBillingAt ? `다음 결제 ${dateLabel(calltagSubscription.nextBillingAt)}` : '통합권 결제 없음'}</small>
            </div>
            <div>
              <span>HTTPS · SSL</span>
              <strong>{sslIncluded ? '프로 포함' : sslEnabled ? '이용 중' : '미이용'}</strong>
              <small>{sslIncluded ? '추가 비용 없음' : sslEnabled ? '월 1,000원' : '선택 부가서비스'}</small>
            </div>
          </div>
        </section>

        {error && <p className="settings-message error" role="alert">{error}</p>}

        {loading && !finance ? (
          <div className="settings-loading">결제 정보를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="settings-surface billing-group">
              <div className="settings-surface-head simple">
                <div>
                  <strong>페이지로 요금제</strong>
                  <small>현재 상태를 확인한 뒤 필요한 플랜으로 변경합니다.</small>
                </div>
              </div>
              <div className="billing-plan-list">
                {pageroPlans.map((plan) => {
                  const included = bundleClassic && plan.code === 'pagero_monthly';
                  const current = isPageroCurrent(plan);
                  return (
                    <PlanRow
                      key={plan.code}
                      name={plan.name}
                      description={plan.description}
                      price={money(plan.amountKrw)}
                      current={current && !included}
                      included={included}
                      busy={busy === `pagero:${plan.code}`}
                      onClick={() => checkout('pagero', plan.code)}
                    />
                  );
                })}
              </div>
            </section>

            <section className="settings-surface billing-group calltag-bundle-group">
              <div className="settings-surface-head simple">
                <div>
                  <strong>콜태그 통합권</strong>
                  <small>페이지로 웹에서는 통합권 하나만 판매합니다.</small>
                </div>
              </div>
              <div className="billing-plan-list">
                <PlanRow
                  name="통합권"
                  description="페이지로 클래식 + 콜태그 전화관리 + 문자자동화"
                  price={money(calltagBundle?.amountKrw || 6000)}
                  current={bundleActive}
                  busy={busy === 'calltag:all_monthly'}
                  onClick={() => checkout('calltag', 'all_monthly')}
                  badge="통합"
                />
              </div>
              <div className="billing-bundle-chips" aria-label="콜태그 통합권 포함 서비스">
                <span>페이지로 클래식</span>
                <span>전화관리</span>
                <span>문자자동화</span>
              </div>
            </section>

            <section className="settings-surface billing-addon-row">
              <div className="settings-icon-title">
                <span className="settings-icon-box"><ShieldCheck size={19} aria-hidden="true" /></span>
                <div>
                  <strong>HTTPS · SSL 관리</strong>
                  <small>도메인 연결은 무료이며 인증서 발급·갱신 관리만 유료입니다.</small>
                </div>
              </div>
              <div className="billing-addon-action">
                <b>{sslIncluded ? '포함' : '1,000원'}{!sslIncluded && <span>/월</span>}</b>
                <button
                  type="button"
                  className={sslEnabled || sslIncluded ? 'settings-secondary-button' : 'settings-primary-button'}
                  disabled={sslEnabled || sslIncluded || busy === 'domain:pagero_domain_monthly'}
                  onClick={() => checkout('domain', 'pagero_domain_monthly')}
                >
                  {sslIncluded ? '프로 포함' : sslEnabled ? '이용 중' : '신청'}
                </button>
              </div>
            </section>

            <section className="settings-surface billing-history-surface">
              <div className="settings-surface-head simple">
                <div>
                  <strong>구독 기록</strong>
                  <small>최근 구독 상태와 결제 채널을 확인합니다.</small>
                </div>
              </div>
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
                <p className="settings-empty-copy">아직 구독 기록이 없습니다.</p>
              )}
            </section>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

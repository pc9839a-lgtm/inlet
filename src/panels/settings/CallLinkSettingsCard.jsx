import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Link2, MessageSquareText, RefreshCw, Save, WalletCards } from 'lucide-react';

function projectRequest(page) {
  const projectId = String(page?.projectId || page?.project_id || '').trim();
  const slug = String(page?.slug || '').trim();
  if (projectId) return { projectId };
  if (slug) return { slug };
  return {};
}

function queryString(project) {
  const params = new URLSearchParams();
  if (project.projectId) params.set('projectId', project.projectId);
  if (project.slug) params.set('slug', project.slug);
  return params.toString();
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.message || payload?.error || `요청 실패 (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function formatMoney(value) {
  return `${Math.max(0, Number(value || 0)).toLocaleString('ko-KR')}원`;
}

function formatRemaining(expiresAt) {
  const millis = Date.parse(expiresAt || '') - Date.now();
  if (!Number.isFinite(millis) || millis <= 0) return '만료됨';
  const seconds = Math.ceil(millis / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')} 남음`;
}

export default function CallLinkSettingsCard({ page }) {
  const project = useMemo(() => projectRequest(page), [page]);
  const query = useMemo(() => queryString(project), [project]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connectionCode, setConnectionCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [, setTick] = useState(0);
  const [channel, setChannel] = useState({
    solapiEnabled: false,
    senderNumber: '',
    kakaoChannelId: '',
    kakaoTemplateId: '',
    fallbackSmsEnabled: true,
    status: 'not_configured',
    solapiSecretConfigured: false,
  });
  const [wallet, setWallet] = useState({ balance: 0, currency: 'KRW' });
  const [provider, setProvider] = useState(null);
  const [providerAvailable, setProviderAvailable] = useState(false);
  const [prices, setPrices] = useState({ sms: 18, lms: 45, mms: 110, alimtalk: 13 });

  const refresh = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    setError('');
    try {
      const [channelPayload, balancePayload, pricingPayload] = await Promise.all([
        apiJson(`/api/calllink/channels?${query}`),
        apiJson(`/api/calllink/balance?${query}`),
        apiJson(`/api/calllink/pricing?${query}`),
      ]);
      setChannel((current) => ({ ...current, ...(channelPayload.channel || {}) }));
      setWallet(balancePayload.wallet || { balance: 0, currency: 'KRW' });
      setProvider(balancePayload.provider || null);
      setProviderAvailable(balancePayload.providerAvailable === true);
      setPrices(pricingPayload.prices || prices);
    } catch (requestError) {
      setError(requestError?.message || '콜링크 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const generateCode = async () => {
    if (!Object.keys(project).length) {
      setError('현재 페이지의 사업장 정보를 확인하지 못했습니다.');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const payload = await apiJson('/api/calllink/connection-code', {
        method: 'POST',
        body: JSON.stringify(project),
      });
      setConnectionCode(payload.connectionCode || '');
      setExpiresAt(payload.expiresAt || '');
      setNotice('앱 설정 → 페이지로 비즈메시지에서 연결코드를 입력하세요.');
    } catch (requestError) {
      setError(requestError?.message || '연결코드를 발급하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!connectionCode) return;
    try {
      await navigator.clipboard.writeText(connectionCode);
      setNotice('연결코드를 복사했습니다.');
    } catch {
      setNotice('연결코드를 직접 선택해 복사해주세요.');
    }
  };

  const saveChannel = async () => {
    if (!Object.keys(project).length) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = await apiJson('/api/calllink/channels', {
        method: 'POST',
        body: JSON.stringify({
          ...project,
          solapiEnabled: channel.solapiEnabled === true,
          senderNumber: String(channel.senderNumber || '').replace(/[^0-9]/g, ''),
          kakaoChannelId: String(channel.kakaoChannelId || '').trim(),
          kakaoTemplateId: String(channel.kakaoTemplateId || '').trim(),
          fallbackSmsEnabled: channel.fallbackSmsEnabled !== false,
        }),
      });
      setChannel((current) => ({ ...current, ...(payload.channel || {}) }));
      setNotice('콜링크 발송 채널 설정을 저장했습니다.');
    } catch (requestError) {
      setError(requestError?.message || '발송 채널 설정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const codeExpired = connectionCode && Date.parse(expiresAt || '') <= Date.now();

  return (
    <section className="settings-section" aria-labelledby="calllink-settings-title">
      <div className="settings-section__heading-row">
        <div>
          <h3 id="calllink-settings-title">페이지로 콜링크</h3>
          <p>통화 후 자동문자 앱을 사업장과 연결하고 솔라피 문자·카카오 알림톡을 관리합니다.</p>
        </div>
        <button type="button" className="secondary-button" onClick={refresh} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? '확인 중' : '새로고침'}
        </button>
      </div>

      {error ? <p className="settings-inline-message is-error" role="alert">{error}</p> : null}
      {notice ? <p className="settings-inline-message" role="status">{notice}</p> : null}

      <div className="settings-grid-two">
        <div className="settings-card settings-card--compact">
          <div className="settings-card__title-row">
            <Link2 size={18} aria-hidden="true" />
            <strong>Android 앱 연결</strong>
          </div>
          <p className="settings-card__description">
            별도 로그인 없이 6자리 코드로 연결합니다. 코드는 10분 뒤 만료되며 한 번만 사용할 수 있습니다.
          </p>
          {connectionCode ? (
            <div className={`calllink-code${codeExpired ? ' is-expired' : ''}`}>
              <span>{connectionCode}</span>
              <small>{formatRemaining(expiresAt)}</small>
              <button type="button" onClick={copyCode} disabled={codeExpired} aria-label="연결코드 복사">
                <Copy size={16} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <button type="button" className="primary-button" onClick={generateCode} disabled={loading}>
            {connectionCode && !codeExpired ? '새 연결코드 발급' : '연결코드 발급'}
          </button>
        </div>

        <div className="settings-card settings-card--compact">
          <div className="settings-card__title-row">
            <WalletCards size={18} aria-hidden="true" />
            <strong>메시지 잔액</strong>
          </div>
          <div className="calllink-balance-value">{formatMoney(wallet.balance)}</div>
          <p className="settings-card__description">
            고객 충전잔액입니다. 페이지로 결제 완료 후 서버 전용 충전 API로 자동 반영합니다.
          </p>
          <div className="calllink-provider-balance">
            <span>솔라피 공급자 잔액</span>
            <strong>{providerAvailable && provider ? formatMoney(Number(provider.balance || 0) + Number(provider.point || 0)) : 'Secret 설정 필요'}</strong>
          </div>
          <div className="calllink-price-list">
            <span>SMS {formatMoney(prices.sms)}</span>
            <span>LMS {formatMoney(prices.lms)}</span>
            <span>MMS {formatMoney(prices.mms)}</span>
            <span>알림톡 {formatMoney(prices.alimtalk)}</span>
          </div>
        </div>
      </div>

      <div className="settings-card settings-card--compact">
        <div className="settings-card__title-row">
          <MessageSquareText size={18} aria-hidden="true" />
          <strong>솔라피·알림톡 채널</strong>
          <span className={`settings-status-pill ${channel.status === 'active' ? 'is-active' : ''}`}>
            {channel.status === 'active' ? '사용 가능' : '설정 필요'}
          </span>
        </div>

        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={channel.solapiEnabled === true}
            onChange={(event) => setChannel((current) => ({ ...current, solapiEnabled: event.target.checked }))}
          />
          <span>솔라피 문자·알림톡 사용</span>
        </label>

        <div className="settings-grid-two">
          <label className="field">
            <span>등록된 발신번호</span>
            <input
              type="tel"
              value={channel.senderNumber || ''}
              onChange={(event) => setChannel((current) => ({ ...current, senderNumber: event.target.value }))}
              placeholder="예: 01012345678"
            />
          </label>
          <label className="field">
            <span>카카오 발신프로필 ID</span>
            <input
              type="text"
              value={channel.kakaoChannelId || ''}
              onChange={(event) => setChannel((current) => ({ ...current, kakaoChannelId: event.target.value }))}
              placeholder="솔라피 pfId"
            />
          </label>
        </div>

        <label className="field">
          <span>승인된 알림톡 템플릿 ID</span>
          <input
            type="text"
            value={channel.kakaoTemplateId || ''}
            onChange={(event) => setChannel((current) => ({ ...current, kakaoTemplateId: event.target.value }))}
            placeholder="솔라피 templateId"
          />
        </label>

        <label className="field field--checkbox">
          <input
            type="checkbox"
            checked={channel.fallbackSmsEnabled !== false}
            onChange={(event) => setChannel((current) => ({ ...current, fallbackSmsEnabled: event.target.checked }))}
          />
          <span>알림톡 실패 시 동일 내용 문자로 대체발송</span>
        </label>

        {!channel.solapiSecretConfigured ? (
          <p className="settings-inline-message is-warning">
            Cloudflare Secret에 SOLAPI_API_KEY와 SOLAPI_API_SECRET을 등록해야 실제 발송됩니다.
          </p>
        ) : null}

        <div className="button-row">
          <button type="button" className="primary-button" onClick={saveChannel} disabled={saving}>
            <Save size={16} aria-hidden="true" />
            {saving ? '저장 중' : '발송 채널 저장'}
          </button>
        </div>
      </div>
    </section>
  );
}

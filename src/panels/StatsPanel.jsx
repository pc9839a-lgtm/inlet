import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, Inbox, LayoutDashboard, Megaphone } from 'lucide-react';
import { leadKindLabel, leadPrimaryContact } from '../lib/leadModel.js';
import { currentMonthValue } from '../lib/monthRange.js';
import { PERIOD_OPTIONS, buildStats as buildStatsMetrics, countBy as countByMetrics, statLabel } from '../lib/statsMetrics.js';
import { trafficChannelFromItem } from '../lib/trafficAttribution.js';
import './StatsPanel.css';

const STATS_VIEWS = [
  { id: 'overview', label: '개요', icon: LayoutDashboard },
  { id: 'conversion', label: '전환', icon: GitBranch },
  { id: 'traffic', label: '유입', icon: Megaphone },
  { id: 'leads', label: '접수', icon: Inbox },
];

function hasPartialStatsData({ statsPartial, eventPageMeta, leadPageMeta }) {
  return Boolean(statsPartial || eventPageMeta?.hasMore || eventPageMeta?.nextCursor || leadPageMeta?.hasMore || leadPageMeta?.nextCursor);
}

function filterByChannel(items = [], channel = 'all') {
  if (channel === 'all') return items;
  return items.filter((item) => trafficChannelFromItem(item) === channel);
}

function buildChannelOptions(events = [], leads = []) {
  const counts = new Map();
  [...events, ...leads].forEach((item) => {
    const key = trafficChannelFromItem(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count);
}

function stableChannelOptions(items = []) {
  const defaults = ['direct', 'naver', 'google', 'kakao', 'instagram', 'meta', 'youtube', 'referral'];
  const order = new Map(defaults.map((channel, index) => [channel, index]));
  const counts = new Map(defaults.map((channel) => [channel, 0]));
  items.forEach((item) => counts.set(String(item.channel || 'direct'), Number(item.count || 0)));
  return Array.from(counts.entries())
    .map(([channel, count]) => ({ channel, count }))
    .filter((item) => item.count > 0 || defaults.includes(item.channel))
    .sort((a, b) => (b.count - a.count) || ((order.get(a.channel) ?? 99) - (order.get(b.channel) ?? 99)));
}

function collectPageCtaLabels(page = {}) {
  const labels = [];
  const push = (value) => {
    const text = String(value || '').trim();
    if (text && !labels.includes(text)) labels.push(text);
  };
  (page.blocks || []).forEach((block) => {
    if (!block || block.visible === false) return;
    const s = block.s || {};
    if (block.type === 'topnav') (Array.isArray(s.menus) ? s.menus : []).forEach((item) => push(item?.label));
    if (block.type === 'links') (Array.isArray(s.items) ? s.items : []).forEach((item) => push(item?.label));
    if (block.type === 'timer' && s.cta) push(s.ctaLabel || '상담 신청');
    if (block.type === 'bottombar') {
      (Array.isArray(s.buttons) ? s.buttons : [])
        .slice(0, Number(s.count || s.buttons?.length || 0))
        .filter((button) => button?.enabled !== false)
        .forEach((button) => push(button?.label));
    }
  });
  return labels;
}

function ctaClickData(events = [], page = {}) {
  const labels = collectPageCtaLabels(page);
  const allowed = new Set(labels);
  const clicks = events.filter((event) => event.type === 'cta_click' && (!allowed.size || allowed.has(String(event.label || '').trim())));
  const counts = countByMetrics(clicks, 'label');
  if (!allowed.size) return counts;
  return Object.fromEntries(labels.filter((label) => counts[label]).map((label) => [label, counts[label]]));
}

function normalizeServerStats(serverStats, leads = []) {
  const summary = serverStats?.summary || {};
  return {
    pv: Number(summary.pv || 0),
    cta: Number(summary.cta || 0),
    consultLeads: Number(summary.consultLeads || 0),
    reservationLeads: Number(summary.reservationLeads || 0),
    conversion: String(summary.conversion ?? '0.0'),
    ctaConversion: String(summary.ctaConversion ?? '0.0'),
    formStart: Number(summary.formStart || 0),
    submitAttempt: Number(summary.submitAttempt || 0),
    submitSuccess: Number(summary.submitSuccess || 0),
    reservationAttempt: Number(summary.reservationAttempt || 0),
    reservationSuccess: Number(summary.reservationSuccess || 0),
    formStartRate: String(summary.formStartRate ?? '0.0'),
    formCompletionRate: String(summary.formCompletionRate ?? '0.0'),
    reservationCompletionRate: String(summary.reservationCompletionRate ?? '0.0'),
    comparison: serverStats?.comparison?.summary || null,
    trend: Array.isArray(summary.trend) ? summary.trend : [],
    statusData: summary.statusData || {},
    typeData: summary.typeData || {},
    channelData: summary.channelData || {},
    channelOptionsData: summary.availableChannelData || summary.channelData || {},
    deviceData: summary.deviceData || {},
    ctaLabelData: summary.ctaLabelData || {},
    filteredEvents: [],
    filteredLeads: leads || [],
  };
}

function countMetricChange(current, previous) {
  if (previous == null) return null;
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  if (!previousValue) return currentValue ? { label: '신규', tone: 'up' } : { label: '0%', tone: 'flat' };
  const change = ((currentValue - previousValue) / previousValue) * 100;
  return {
    label: (change > 0 ? '+' : '') + change.toFixed(1) + '%',
    tone: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

function rateMetricChange(current, previous) {
  if (previous == null) return null;
  const change = Number(current || 0) - Number(previous || 0);
  return {
    label: (change > 0 ? '+' : '') + change.toFixed(1) + '%p',
    tone: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

function Metric({ title, value, sub, change = null }) {
  return (
    <div className="stats-v4-metric">
      <span>{title}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
      {change && <em className={'stats-v4-change ' + change.tone}>{change.label}</em>}
    </div>
  );
}

function FunnelRow({ title, startLabel, startValue, endLabel, endValue, rate }) {
  return (
    <div className="stats-v4-funnel-row">
      <strong>{title}</strong>
      <span>{startLabel}<b>{Number(startValue || 0).toLocaleString('ko-KR')}</b></span>
      <i aria-hidden="true">→</i>
      <span>{endLabel}<b>{Number(endValue || 0).toLocaleString('ko-KR')}</b></span>
      <em>{rate}%</em>
    </div>
  );
}

function fmtDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function StatsTrend({ data }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((sum, row) => sum + Number(row.pv || 0) + Number(row.cta || 0) + Number(row.db || 0), 0);
  if (!total) return <div className="stats-v4-empty">선택한 기간에 표시할 데이터가 없습니다.</div>;
  const max = Math.max(1, ...data.flatMap((row) => [row.pv, row.cta, row.db]));
  const width = 720;
  const height = 220;
  const padX = 34;
  const padTop = 18;
  const padBottom = 34;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const x = (index) => padX + (data.length <= 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (v) => padTop + plotH - (Number(v || 0) / max) * plotH;
  const points = (key) => data.map((row, index) => x(index).toFixed(1) + ',' + y(row[key]).toFixed(1)).join(' ');
  const labelEvery = data.length <= 14 ? 1 : Math.ceil(data.length / 8);
  const series = [['pv', '조회'], ['cta', '클릭'], ['db', '접수']];
  const hoverTop = (row) => Math.min(y(row.pv), y(row.cta), y(row.db));

  return (
    <div className="stats-v4-trend" role="img" aria-label="상세 통계">
      <svg viewBox={'0 0 ' + width + ' ' + height} preserveAspectRatio="none" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} className="guide" x1={padX} x2={width - padX} y1={padTop + plotH * ratio} y2={padTop + plotH * ratio} />
        ))}
        {series.map(([key]) => <polyline key={key} className={'line ' + key} points={points(key)} />)}
        {series.map(([key]) => data.map((row, index) => (
          <circle key={key + '-' + (row.id || index)} className={'dot ' + key} cx={x(index)} cy={y(row[key])} r="4" />
        )))}
        {data.map((row, index) => {
          const show = index === 0 || index === data.length - 1 || index % labelEvery === 0;
          return show ? <text key={row.id || row.label} className="axis-label" x={x(index)} y={height - 9} textAnchor="middle">{row.label}</text> : null;
        })}
        {data.map((row, index) => (
          <rect
            key={'hit-' + (row.id || row.label || index)}
            className="hit"
            x={Math.max(0, x(index) - Math.max(16, plotW / Math.max(1, data.length - 1) / 2))}
            y="0"
            width={Math.min(width, Math.max(32, plotW / Math.max(1, data.length - 1)))}
            height={height}
            onMouseEnter={() => setHover({ row, x: x(index), y: hoverTop(row) })}
            onMouseMove={() => setHover({ row, x: x(index), y: hoverTop(row) })}
          />
        ))}
      </svg>
      {hover && (
        <div className="stats-v4-tooltip" style={{ left: String((hover.x / width) * 100) + '%', top: String(Math.max(82, hover.y)) + 'px' }}>
          <span>{hover.row.id || hover.row.label}</span>
          <strong>조회 {Number(hover.row.pv || 0).toLocaleString('ko-KR')}</strong>
          <em>클릭 {Number(hover.row.cta || 0).toLocaleString('ko-KR')} / 접수 {Number(hover.row.db || 0).toLocaleString('ko-KR')}</em>
        </div>
      )}
      <div className="stats-v4-legend">{series.map(([key, label]) => <b key={key}><i className={key} />{label}</b>)}</div>
    </div>
  );
}

function StatCard({ title, data }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return (
    <section className="stats-v4-card stats-v4-stat-card">
      <div className="stats-v4-card-title"><h2>{title}</h2></div>
      {!entries.length ? <div className="stats-v4-empty">데이터 없음</div> : (
        <div className="stats-v4-stat-list">
          {entries.slice(0, 8).map(([key, value]) => (
            <div className="stats-v4-stat-row" key={key}>
              <span>{statLabel(key)}</span>
              <div><i style={{ width: String(Math.max(4, Number(value || 0) / max * 100)) + '%' }} /></div>
              <b>{value}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentLeads({ leads, total }) {
  return (
    <section className="stats-v4-card stats-v4-leads-card">
      <div className="stats-v4-card-title">
        <h2>최근 접수</h2>
        <p>{total > leads.length ? `전체 ${total}건 중 최근 ${leads.length}건` : `${leads.length}건`}</p>
      </div>
      {!leads.length ? <div className="stats-v4-empty">접수 데이터가 없습니다.</div> : (
        <div className="stats-v4-lead-list">
          {leads.slice(0, 8).map((lead) => (
            <div key={lead.id || lead.createdAt}>
              <span>{leadKindLabel(lead)}</span>
              <b>{lead.name || '이름 없음'}</b>
              <em>{leadPrimaryContact(lead)}</em>
              <small title={fmtDateOnly(lead.createdAt)}>{fmtDateOnly(lead.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function StatsPanel({
  events,
  leads,
  page,
  eventPageMeta,
  leadPageMeta,
  statsPartial = false,
  month: controlledMonth = currentMonthValue(),
  onMonthChange,
  period: controlledPeriod = '30d',
  onPeriodChange,
  serverStats = null,
  channel: controlledChannel = 'all',
  onChannelChange,
}) {
  const [activeView, setActiveView] = useState('overview');
  const [localMonth, setLocalMonth] = useState(controlledMonth || currentMonthValue());
  const [localPeriod, setLocalPeriod] = useState(controlledPeriod || '30d');
  const [localChannel, setLocalChannel] = useState(controlledChannel || 'all');
  const month = controlledMonth || localMonth || currentMonthValue();
  const period = controlledPeriod || localPeriod || '30d';
  const serverMode = !!serverStats?.summary;
  const channelFilter = controlledChannel || localChannel || 'all';

  const setMonth = (value) => {
    const next = value || currentMonthValue();
    setLocalMonth(next);
    onMonthChange?.(next);
  };

  const setPeriod = (value) => {
    const next = ['1d', '7d', '14d', '30d'].includes(String(value || '')) ? value : '30d';
    setLocalPeriod(next);
    onPeriodChange?.(next);
  };

  const setChannel = (value) => {
    const next = value || 'all';
    setLocalChannel(next);
    onChannelChange?.(next);
  };

  const baseStats = useMemo(() => {
    if (serverMode) return normalizeServerStats(serverStats, leads);
    return buildStatsMetrics(events, leads, period);
  }, [events, leads, period, serverMode, serverStats]);

  const channelOptions = useMemo(() => {
    if (serverMode) {
      return stableChannelOptions(Object.entries(baseStats.channelOptionsData || {}).map(([channelName, count]) => ({ channel: channelName, count })));
    }
    return stableChannelOptions(buildChannelOptions(baseStats.filteredEvents, baseStats.filteredLeads));
  }, [baseStats, serverMode]);

  const scopedEvents = useMemo(() => filterByChannel(events, channelFilter), [events, channelFilter]);
  const scopedLeads = useMemo(() => filterByChannel(leads, channelFilter), [leads, channelFilter]);
  const stats = useMemo(() => {
    if (serverMode) return baseStats;
    return buildStatsMetrics(scopedEvents, scopedLeads, period);
  }, [baseStats, period, scopedEvents, scopedLeads, serverMode]);
  const partialData = statsPartial || (!serverMode && hasPartialStatsData({ statsPartial, eventPageMeta, leadPageMeta }));
  const recentLeadTotal = Number(leadPageMeta?.total || stats.filteredLeads.length);
  const activeLabel = STATS_VIEWS.find((item) => item.id === activeView)?.label || '개요';

  useEffect(() => {
    if (channelFilter !== 'all' && !channelOptions.some((item) => item.channel === channelFilter)) setChannel('all');
  }, [channelFilter, channelOptions]);

  return (
    <div className="stats-panel stats-v4">
      <aside className="stats-v4-sidebar">
        <div className="stats-v4-sidebar-title">통계</div>
        <nav className="stats-v4-nav" aria-label="통계 메뉴">
          {STATS_VIEWS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button key={item.id} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => setActiveView(item.id)}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="stats-v4-main">
        <header className="stats-v4-page-head">
          <h1>{activeLabel}</h1>
          {stats.comparison && <span>직전 동일 기간 대비</span>}
        </header>

        <section className="stats-v4-filterbar" aria-label="통계 필터">
          <div className="stats-v4-period-tabs">
            {PERIOD_OPTIONS.map(([value, label]) => (
              <button type="button" key={value} className={period === value ? 'active' : ''} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>
            ))}
          </div>
          <label className="stats-v4-filter-control">
            <span>월</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label className="stats-v4-filter-control stats-v4-channel-control">
            <span>유입</span>
            <select value={channelFilter} onChange={(event) => setChannel(event.target.value)}>
              <option value="all">전체 채널</option>
              {channelOptions.map((item) => <option key={item.channel} value={item.channel}>{statLabel(item.channel)} · {item.count}</option>)}
            </select>
          </label>
        </section>

        {partialData && <div className="stats-v4-notice" role="status">일부 데이터만 표시 중입니다.</div>}

        {activeView === 'overview' && (
          <div className="stats-v4-view">
            <section className="stats-v4-summary">
              <Metric title="조회" value={stats.pv} sub="방문" change={countMetricChange(stats.pv, stats.comparison?.pv)} />
              <Metric title="클릭" value={stats.cta} sub="버튼" change={countMetricChange(stats.cta, stats.comparison?.cta)} />
              <Metric title="상담" value={stats.consultLeads} sub="접수" change={countMetricChange(stats.consultLeads, stats.comparison?.consultLeads)} />
              <Metric title="예약" value={stats.reservationLeads} sub="접수" change={countMetricChange(stats.reservationLeads, stats.comparison?.reservationLeads)} />
              <Metric title="전환율" value={stats.conversion + '%'} sub="방문 대비" change={rateMetricChange(stats.conversion, stats.comparison?.conversion)} />
              <Metric title="CTA 전환" value={stats.ctaConversion + '%'} sub="클릭 대비" change={rateMetricChange(stats.ctaConversion, stats.comparison?.ctaConversion)} />
            </section>

            <section className="stats-v4-split stats-v4-overview-split">
              <div className="stats-v4-card stats-v4-trend-card">
                <div className="stats-v4-card-title"><h2>성과 흐름</h2></div>
                <StatsTrend data={stats.trend} />
              </div>
              <div className="stats-v4-card stats-v4-funnel-card">
                <div className="stats-v4-card-title"><h2>전환 단계</h2></div>
                <div className="stats-v4-funnel-list">
                  <FunnelRow title="상담 시작" startLabel="조회" startValue={stats.pv} endLabel="폼 시작" endValue={stats.formStart} rate={stats.formStartRate} />
                  <FunnelRow title="상담 제출" startLabel="제출 시도" startValue={stats.submitAttempt} endLabel="제출 완료" endValue={stats.submitSuccess} rate={stats.formCompletionRate} />
                  <FunnelRow title="방문 예약" startLabel="제출 시도" startValue={stats.reservationAttempt} endLabel="예약 완료" endValue={stats.reservationSuccess} rate={stats.reservationCompletionRate} />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeView === 'conversion' && (
          <div className="stats-v4-view">
            <section className="stats-v4-split">
              <div className="stats-v4-card stats-v4-funnel-card">
                <div className="stats-v4-card-title"><h2>전환 단계</h2></div>
                <div className="stats-v4-funnel-list">
                  <FunnelRow title="상담 시작" startLabel="조회" startValue={stats.pv} endLabel="폼 시작" endValue={stats.formStart} rate={stats.formStartRate} />
                  <FunnelRow title="상담 제출" startLabel="제출 시도" startValue={stats.submitAttempt} endLabel="제출 완료" endValue={stats.submitSuccess} rate={stats.formCompletionRate} />
                  <FunnelRow title="방문 예약" startLabel="제출 시도" startValue={stats.reservationAttempt} endLabel="예약 완료" endValue={stats.reservationSuccess} rate={stats.reservationCompletionRate} />
                </div>
              </div>
              <StatCard title="CTA 클릭 위치" data={serverMode ? stats.ctaLabelData : ctaClickData(stats.filteredEvents, page)} />
            </section>
          </div>
        )}

        {activeView === 'traffic' && (
          <div className="stats-v4-view">
            <section className="stats-v4-split">
              <StatCard title="유입 채널" data={stats.channelData} />
              <StatCard title="유입 기기" data={serverMode ? stats.deviceData : countByMetrics(stats.filteredEvents, 'device')} />
            </section>
          </div>
        )}

        {activeView === 'leads' && (
          <div className="stats-v4-view">
            <section className="stats-v4-split">
              <StatCard title="접수 유형" data={stats.typeData} />
              <StatCard title="접수 상태" data={stats.statusData} />
            </section>
            <RecentLeads leads={stats.filteredLeads} total={recentLeadTotal} />
          </div>
        )}
      </main>
    </div>
  );
}

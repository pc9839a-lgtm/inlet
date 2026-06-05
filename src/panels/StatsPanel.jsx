import React, { useEffect, useMemo, useState } from 'react';
import { leadKindLabel, leadPrimaryContact } from '../lib/leadModel.js';
import { currentMonthValue } from '../lib/monthRange.js';
import { PERIOD_OPTIONS, buildStats as buildStatsMetrics, countBy as countByMetrics, statLabel } from '../lib/statsMetrics.js';
import { trafficChannelFromItem } from '../lib/trafficAttribution.js';
import './StatsPanel.css';

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

function Metric({ title, value, sub }) {
  return (
    <div className="metric metric-v2">
      <span>{title}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function fmtDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function ChannelFilter({ channels, value, onChange }) {
  const total = channels.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const visible = channels.slice(0, 8);
  return (
    <section className="card stats-channel-filter">
      <div className="section-title"><h2>유입 채널</h2></div>
      <div className="stats-channel-filter-list">
        <button type="button" className={value === 'all' ? 'active' : ''} onClick={() => onChange('all')}>
          <span>전체</span><b>{total}</b>
        </button>
        {visible.map((item) => (
          <button type="button" key={item.channel} className={value === item.channel ? 'active' : ''} onClick={() => onChange(item.channel)}>
            <span>{statLabel(item.channel)}</span><b>{item.count}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function StatsTrend({ data }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((sum, row) => sum + Number(row.pv || 0) + Number(row.cta || 0) + Number(row.db || 0), 0);
  if (!total) return <div className="stats-empty-chart">선택한 기간에 표시할 데이터가 없습니다.</div>;
  const max = Math.max(1, ...data.flatMap((row) => [row.pv, row.cta, row.db]));
  const width = 720;
  const height = 240;
  const padX = 34;
  const padTop = 22;
  const padBottom = 36;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const x = (index) => padX + (data.length <= 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value) => padTop + plotH - (Number(value || 0) / max) * plotH;
  const points = (key) => data.map((row, index) => `${x(index).toFixed(1)},${y(row[key]).toFixed(1)}`).join(' ');
  const labelEvery = data.length <= 14 ? 1 : Math.ceil(data.length / 8);
  const series = [['pv', '조회'], ['cta', '클릭'], ['db', '접수']];
  const hoverTop = (row) => Math.min(y(row.pv), y(row.cta), y(row.db));

  return (
    <div className="stats-line-chart stats-trend-line stats-line-plot" role="img" aria-label="상세 통계">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} className="guide" x1={padX} x2={width - padX} y1={padTop + plotH * ratio} y2={padTop + plotH * ratio} />
        ))}
        {series.map(([key]) => <polyline key={key} className={`line ${key}`} points={points(key)} />)}
        {series.map(([key]) => data.map((row, index) => (
          <circle key={`${key}-${row.id || index}`} className={`dot ${key}`} cx={x(index)} cy={y(row[key])} r="4" />
        )))}
        {data.map((row, index) => {
          const show = index === 0 || index === data.length - 1 || index % labelEvery === 0;
          return show ? <text key={row.id || row.label} className="axis-label" x={x(index)} y={height - 10} textAnchor="middle">{row.label}</text> : null;
        })}
        {data.map((row, index) => (
          <rect
            key={`hit-${row.id || row.label || index}`}
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
        <div className="stats-chart-tooltip stats-chart-tooltip-wide" style={{ left: `${(hover.x / width) * 100}%`, top: `${hover.y}px` }}>
          <span>{hover.row.id || hover.row.label}</span>
          <strong>조회 {Number(hover.row.pv || 0).toLocaleString('ko-KR')}</strong>
          <em>클릭 {Number(hover.row.cta || 0).toLocaleString('ko-KR')} / 접수 {Number(hover.row.db || 0).toLocaleString('ko-KR')}</em>
        </div>
      )}
      <div className="trend-legend">{series.map(([key, label]) => <b key={key}><i className={key} />{label}</b>)}</div>
    </div>
  );
}

function StatCard({ title, data }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return (
    <section className="card stat-card-v2">
      <div className="section-title"><h2>{title}</h2></div>
      {!entries.length ? <div className="empty">데이터 없음</div> : (
        <div className="stat-list stat-list-v2">
          {entries.slice(0, 8).map(([key, value]) => (
            <div className="stat-row stat-row-v2" key={key}>
              <span>{statLabel(key)}</span>
              <div><i style={{ width: `${Math.max(4, Number(value || 0) / max * 100)}%` }} /></div>
              <b>{value}</b>
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
  const partialData = hasPartialStatsData({ statsPartial, eventPageMeta, leadPageMeta });

  useEffect(() => {
    if (channelFilter !== 'all' && !channelOptions.some((item) => item.channel === channelFilter)) setChannel('all');
  }, [channelFilter, channelOptions]);

  return (
    <div className="simple-panel stats-panel stats-v2 stats-v3">
      <section className="card period-card stats-period-card">
        <div className="section-title"><h2>상세 통계</h2></div>
        <div className="stats-period-controls">
          <div className="period-tabs period-tabs-v2 stats-range-tabs" aria-label="통계 기간">
            {PERIOD_OPTIONS.map(([value, label]) => (
              <button type="button" key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{label}</button>
            ))}
          </div>
          <label className="stats-month-control">
            <span>월 선택</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>
      </section>

      <ChannelFilter channels={channelOptions} value={channelFilter} onChange={setChannel} />

      {partialData && <div className="stats-partial-notice" role="status">일부 데이터만 표시 중입니다.</div>}

      <section className="stats-grid stats-summary stats-summary-v2 stats-summary-v3">
        <Metric title="조회" value={stats.pv} sub="방문" />
        <Metric title="클릭" value={stats.cta} sub="버튼" />
        <Metric title="상담" value={stats.consultLeads} sub="접수" />
        <Metric title="예약" value={stats.reservationLeads} sub="접수" />
        <Metric title="전환율" value={`${stats.conversion}%`} sub="방문 대비" />
        <Metric title="CTA 전환" value={`${stats.ctaConversion}%`} sub="클릭 대비" />
      </section>

      <section className="card stats-trend-card">
        <div className="section-title"><h2>상세 통계</h2></div>
        <StatsTrend data={stats.trend} />
      </section>

      <section className="stats-columns stats-columns-v3">
        <StatCard title="접수 유형" data={stats.typeData} />
        <StatCard title="접수 상태" data={stats.statusData} />
      </section>

      <section className="stats-columns stats-columns-v3 stats-columns-four">
        <StatCard title="CTA 클릭 위치" data={serverMode ? stats.ctaLabelData : ctaClickData(stats.filteredEvents, page)} />
        <StatCard title="유입 기기" data={serverMode ? stats.deviceData : countByMetrics(stats.filteredEvents, 'device')} />
        <StatCard title="유입 채널" data={serverMode ? stats.channelData : stats.channelData} />
      </section>

      <section className="card stats-lead-table-card stats-lead-table-card-v3">
        <div className="section-title">
          <h2>최근 접수</h2>
          <p>{stats.filteredLeads.length}건</p>
        </div>
        {!stats.filteredLeads.length ? <div className="empty">접수 데이터가 없습니다.</div> : (
          <div className="stats-lead-table stats-lead-table-v3">
            {stats.filteredLeads.slice(0, 8).map((lead) => (
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
    </div>
  );
}

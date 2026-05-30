import React, { useEffect, useMemo, useState } from 'react';
import { deliveryStatusClass, deliveryStatusLabel } from '../lib/leadIntegrations.js';
import { fmtDate, leadKindLabel, leadPrimaryContact } from '../lib/leadModel.js';
import { currentMonthValue } from '../lib/monthRange.js';
import { buildStats as buildStatsMetrics, countBy as countByMetrics, statLabel } from '../lib/statsMetrics.js';
import './StatsPanel.css';

function hasPartialStatsData({ statsPartial, eventPageMeta, leadPageMeta }) {
  return Boolean(
    statsPartial ||
    eventPageMeta?.hasMore ||
    eventPageMeta?.nextCursor ||
    leadPageMeta?.hasMore ||
    leadPageMeta?.nextCursor
  );
}

function channelKey(item = {}) {
  return String(item.channel || item.sourceChannel || item.utmSource || item.source || '').trim().toLowerCase() || 'unknown';
}

function filterByChannel(items = [], channel = 'all') {
  if (channel === 'all') return items;
  return items.filter((item) => channelKey(item) === channel);
}

function buildChannelOptions(events = [], leads = []) {
  const counts = new Map();
  const add = (item) => {
    const key = channelKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  events.forEach(add);
  leads.forEach(add);
  return Array.from(counts.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count);
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
  const clicks = events.filter((event) => {
    if (event.type !== 'cta_click') return false;
    if (!allowed.size) return true;
    return allowed.has(String(event.label || '').trim());
  });
  const counts = countByMetrics(clicks, 'label');
  if (!allowed.size) return counts;
  return Object.fromEntries(labels.filter((label) => counts[label]).map((label) => [label, counts[label]]));
}

function normalizeServerStats(serverStats, leads = []) {
  const summary = serverStats?.summary || {};
  return {
    pv: Number(summary.pv || 0),
    cta: Number(summary.cta || 0),
    link: Number(summary.link || 0),
    formStart: Number(summary.formStart || 0),
    submitAttempt: Number(summary.submitAttempt || 0),
    submitSuccess: Number(summary.submitSuccess || 0),
    reservationAttempt: Number(summary.reservationAttempt || 0),
    reservationSuccess: Number(summary.reservationSuccess || 0),
    consultLeads: Number(summary.consultLeads || 0),
    reservationLeads: Number(summary.reservationLeads || 0),
    db: Number(summary.db || 0),
    conversion: String(summary.conversion ?? '0.0'),
    ctaConversion: String(summary.ctaConversion ?? '0.0'),
    trend: Array.isArray(summary.trend) ? summary.trend : [],
    statusData: summary.statusData || {},
    deliveryData: summary.deliveryData || {},
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

function ChannelFilter({ channels, value, onChange, serverMode }) {
  const total = channels.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const top = channels.slice(0, 7);
  const rest = channels.slice(7);

  return (
    <section className="card stats-channel-filter">
      <div className="section-title">
        <h2>유입 채널</h2>
        <p>{serverMode ? 'UTM 우선 집계' : '화면 데이터 기준'}</p>
      </div>
      <div className="stats-channel-filter-list">
        <button type="button" className={value === 'all' ? 'active' : ''} onClick={() => onChange('all')}>
          <span>전체</span>
          <b>{total}</b>
        </button>
        {top.map((item) => (
          <button type="button" key={item.channel} className={value === item.channel ? 'active' : ''} onClick={() => onChange(item.channel)}>
            <span>{statLabel(item.channel)}</span>
            <b>{item.count}</b>
          </button>
        ))}
        {rest.length > 0 && (
          <select value={rest.some((item) => item.channel === value) ? value : ''} onChange={(event) => event.target.value && onChange(event.target.value)} aria-label="추가 유입 채널">
            <option value="">기타 {rest.length}개</option>
            {rest.map((item) => (
              <option key={item.channel} value={item.channel}>{statLabel(item.channel)} {item.count}</option>
            ))}
          </select>
        )}
      </div>
    </section>
  );
}

function StatsTrend({ data }) {
  const total = data.reduce((sum, row) => sum + Number(row.pv || 0) + Number(row.cta || 0) + Number(row.db || 0), 0);
  if (!total) return <div className="stats-empty-chart">선택한 기간에 데이터가 없습니다.</div>;
  const max = Math.max(1, ...data.flatMap((row) => [row.pv, row.cta, row.db]));
  return (
    <div className="stats-trend-grid compact-trend">
      {data.map((row) => (
        <div className="trend-day" key={row.id || row.label}>
          <div className="trend-bars">
            <i className="pv" style={{ height: `${Math.max(6, Number(row.pv || 0) / max * 100)}%` }} />
            <i className="cta" style={{ height: `${Math.max(6, Number(row.cta || 0) / max * 100)}%` }} />
            <i className="db" style={{ height: `${Math.max(6, Number(row.db || 0) / max * 100)}%` }} />
          </div>
          <span>{row.label}</span>
        </div>
      ))}
      <div className="trend-legend">
        <b><i className="pv" />조회</b>
        <b><i className="cta" />클릭</b>
        <b><i className="db" />접수</b>
      </div>
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
  period: controlledPeriod = currentMonthValue(),
  onPeriodChange,
  serverStats = null,
  channel: controlledChannel = 'all',
  onChannelChange,
}) {
  const [localPeriod, setLocalPeriod] = useState(controlledPeriod || currentMonthValue());
  const [localChannel, setLocalChannel] = useState(controlledChannel || 'all');
  const month = controlledPeriod || localPeriod || currentMonthValue();
  const serverMode = !!serverStats?.summary;
  const channelFilter = controlledChannel || localChannel || 'all';

  const setPeriod = (value) => {
    const next = value || currentMonthValue();
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
    return buildStatsMetrics(events, leads, 'thisMonth');
  }, [events, leads, serverMode, serverStats]);

  const channelOptions = useMemo(() => {
    if (serverMode) {
      return Object.entries(baseStats.channelOptionsData || {})
        .map(([channelName, count]) => ({ channel: channelName, count }))
        .sort((a, b) => b.count - a.count);
    }
    return buildChannelOptions(baseStats.filteredEvents, baseStats.filteredLeads);
  }, [baseStats, serverMode]);

  const scopedEvents = useMemo(() => filterByChannel(events, channelFilter), [events, channelFilter]);
  const scopedLeads = useMemo(() => filterByChannel(leads, channelFilter), [leads, channelFilter]);
  const stats = useMemo(() => {
    if (serverMode) return baseStats;
    return buildStatsMetrics(scopedEvents, scopedLeads, 'thisMonth');
  }, [baseStats, scopedEvents, scopedLeads, serverMode]);
  const partialData = hasPartialStatsData({ statsPartial, eventPageMeta, leadPageMeta });

  useEffect(() => {
    if (channelFilter === 'all') return;
    if (!channelOptions.some((item) => item.channel === channelFilter)) setChannel('all');
  }, [channelFilter, channelOptions]);

  return (
    <div className="simple-panel stats-panel stats-v2 stats-v3">
      <section className="card period-card stats-period-card">
        <div className="section-title">
          <h2>월별 통계</h2>
          <p>{serverMode ? '서버 집계 기준' : '화면 데이터 기준'}</p>
        </div>
        <div className="period-tabs period-tabs-v2 stats-month-control">
          <input type="month" value={month} onChange={(event) => setPeriod(event.target.value)} />
        </div>
      </section>

      <ChannelFilter channels={channelOptions} value={channelFilter} onChange={setChannel} serverMode={serverMode} />

      {partialData && (
        <div className="stats-partial-notice" role="status">
          일부 데이터만 불러온 상태입니다. 서버 집계 연결 상태를 확인하세요.
        </div>
      )}

      <section className="stats-grid stats-summary stats-summary-v2 stats-summary-v3">
        <Metric title="페이지뷰" value={stats.pv} sub="방문" />
        <Metric title="CTA 클릭" value={stats.cta} sub="버튼" />
        <Metric title="상담 접수" value={stats.consultLeads} sub="상담" />
        <Metric title="예약 접수" value={stats.reservationLeads} sub="방문예약" />
        <Metric title="전환율" value={`${stats.conversion}%`} sub="방문 대비" />
        <Metric title="CTA 전환" value={`${stats.ctaConversion}%`} sub="클릭 대비" />
      </section>

      <section className="card stats-trend-card">
        <div className="section-title">
          <h2>월간 추이</h2>
        </div>
        <StatsTrend data={stats.trend} />
      </section>

      <section className="stats-columns stats-columns-v3">
        <StatCard title="접수 유형" data={stats.typeData} />
        <StatCard title="접수 상태" data={stats.statusData} />
      </section>

      <section className="stats-columns stats-columns-v3 stats-columns-four">
        <StatCard title="외부 전송" data={stats.deliveryData} />
        <StatCard title="CTA 클릭 위치" data={serverMode ? stats.ctaLabelData : ctaClickData(stats.filteredEvents, page)} />
        <StatCard title="유입 기기" data={serverMode ? stats.deviceData : countByMetrics(stats.filteredEvents, 'device')} />
        <StatCard title="유입 채널" data={serverMode ? stats.channelData : countByMetrics(stats.filteredEvents, 'channel')} />
      </section>

      <section className="card stats-lead-table-card stats-lead-table-card-v3">
        <div className="section-title">
          <h2>최근 접수</h2>
          <p>{stats.filteredLeads.length}건</p>
        </div>
        {!stats.filteredLeads.length ? <div className="empty">접수 데이터 없음</div> : (
          <div className="stats-lead-table stats-lead-table-v3">
            {stats.filteredLeads.slice(0, 8).map((lead) => (
              <div key={lead.id || lead.createdAt}>
                <span>{leadKindLabel(lead)}</span>
                <b>{lead.name || '이름 없음'}</b>
                <em>{leadPrimaryContact(lead)}</em>
                <i className={`delivery-badge ${deliveryStatusClass(lead.delivery?.status)}`}>{deliveryStatusLabel(lead.delivery?.status)}</i>
                <small>{fmtDate(lead.createdAt)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { deliveryStatusClass, deliveryStatusLabel } from '../lib/leadIntegrations.js';
import { fmtDate, leadKindLabel, leadPrimaryContact } from '../lib/leadModel.js';
import { PERIOD_OPTIONS, buildStats as buildStatsMetrics, countBy as countByMetrics, statLabel } from '../lib/statsMetrics.js';
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

function linePoints(data, key, max, width = 320, height = 154) {
  const padX = 18;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const len = Math.max(1, data.length - 1);

  return data.map((row, idx) => {
    const x = padX + (innerW * idx / len);
    const y = padY + innerH - ((Number(row[key] || 0) / max) * innerH);
    return { x, y, value: Number(row[key] || 0), label: row.label };
  });
}

function pointsAttr(points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function channelKey(item = {}) {
  return String(item.channel || item.sourceChannel || item.utmSource || item.source || '').trim() || 'unknown';
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

function Metric({ title, value, sub }) {
  return (
    <div className="metric metric-v2">
      <span>{title}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function ChannelFilter({ channels, value, onChange }) {
  const total = channels.reduce((sum, item) => sum + item.count, 0);
  const top = channels.slice(0, 7);
  const rest = channels.slice(7);

  return (
    <section className="card stats-channel-filter">
      <div className="section-title">
        <h2>유입 채널</h2>
        <p>{value === 'all' ? '전체 기준' : `${statLabel(value)} 기준`}</p>
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
  const [hover, setHover] = useState(null);
  const total = data.reduce((sum, row) => sum + Number(row.pv || 0) + Number(row.cta || 0) + Number(row.db || 0), 0);
  if (!total) return <div className="stats-empty-chart">선택 기간 데이터 없음</div>;

  const max = Math.max(1, ...data.flatMap((row) => [row.pv, row.cta, row.db]));
  const width = 320;
  const height = 154;
  const pv = linePoints(data, 'pv', max, width, height);
  const cta = linePoints(data, 'cta', max, width, height);
  const db = linePoints(data, 'db', max, width, height);
  const guide = [0, 1, 2].map((idx) => 18 + idx * 56);
  const names = { pv: '조회', cta: '클릭', db: '접수' };

  const point = (type, item, idx) => (
    <g
      key={`${type}-${idx}`}
      className={`chart-point point-${type}`}
      onMouseEnter={() => setHover({ type, ...item })}
      onMouseMove={() => setHover({ type, ...item })}
      onMouseLeave={() => setHover(null)}
    >
      <circle className={`dot ${type}`} cx={item.x} cy={item.y} r="3.4">
        <title>{`${item.label} ${names[type]} ${item.value}`}</title>
      </circle>
      <circle className="hit" cx={item.x} cy={item.y} r="13" />
    </g>
  );

  return (
    <div className="stats-line-chart">
      <div className="stats-line-plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="일별 추이">
          {guide.map((y) => <line key={y} className="guide" x1="18" x2="302" y1={y} y2={y} />)}
          <polyline className="line pv" points={pointsAttr(pv)} />
          <polyline className="line cta" points={pointsAttr(cta)} />
          <polyline className="line db" points={pointsAttr(db)} />
          {pv.map((item, idx) => point('pv', item, idx))}
          {cta.map((item, idx) => point('cta', item, idx))}
          {db.map((item, idx) => point('db', item, idx))}
        </svg>

        {hover && (
          <div
            className={`stats-chart-tooltip tooltip-${hover.type}`}
            style={{ left: `${(hover.x / width) * 100}%`, top: `${(hover.y / height) * 100}%` }}
          >
            <span>{hover.label}</span>
            <strong>{names[hover.type]} {hover.value}</strong>
          </div>
        )}
      </div>

      <div className="line-labels">
        {data.map((row) => <span key={row.id}>{row.label}</span>)}
      </div>

      <div className="trend-legend line-legend">
        <b><i className="pv"></i>조회</b>
        <b><i className="cta"></i>클릭</b>
        <b><i className="db"></i>접수</b>
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
              <div><i style={{ width: `${Math.max(4, value / max * 100)}%` }} /></div>
              <b>{value}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function StatsPanel({ events, leads, page, eventPageMeta, leadPageMeta, statsPartial = false, period: controlledPeriod = '7d', onPeriodChange }) {
  const [localPeriod, setLocalPeriod] = useState(controlledPeriod);
  const [channelFilter, setChannelFilter] = useState('all');
  const period = controlledPeriod || localPeriod;
  const setPeriod = (value) => {
    setLocalPeriod(value);
    onPeriodChange?.(value);
  };
  const baseStats = useMemo(() => buildStatsMetrics(events, leads, period), [events, leads, period]);
  const channelOptions = useMemo(() => buildChannelOptions(baseStats.filteredEvents, baseStats.filteredLeads), [baseStats.filteredEvents, baseStats.filteredLeads]);
  const scopedEvents = useMemo(() => filterByChannel(events, channelFilter), [events, channelFilter]);
  const scopedLeads = useMemo(() => filterByChannel(leads, channelFilter), [leads, channelFilter]);
  const stats = useMemo(() => buildStatsMetrics(scopedEvents, scopedLeads, period), [scopedEvents, scopedLeads, period]);
  const partialData = hasPartialStatsData({ statsPartial, eventPageMeta, leadPageMeta });

  useEffect(() => {
    if (channelFilter === 'all') return;
    if (!channelOptions.some((item) => item.channel === channelFilter)) setChannelFilter('all');
  }, [channelFilter, channelOptions]);

  return (
    <div className="simple-panel stats-panel stats-v2 stats-v3">
      <section className="card period-card stats-period-card">
        <div className="section-title">
          <h2>기간</h2>
        </div>
        <div className="period-tabs period-tabs-v2">
          {PERIOD_OPTIONS.map(([key, text]) => (
            <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{text}</button>
          ))}
        </div>
      </section>

      <ChannelFilter channels={channelOptions} value={channelFilter} onChange={setChannelFilter} />

      {partialData && (
        <div className="stats-partial-notice" role="status">
          서버 페이지가 더 남아 있어 현재 통계는 불러온 데이터 기준입니다.
        </div>
      )}

      <section className="stats-grid stats-summary stats-summary-v2 stats-summary-v3">
        <Metric title="페이지뷰" value={stats.pv} sub="방문" />
        <Metric title="CTA 클릭" value={stats.cta} sub="버튼" />
        <Metric title="상담 접수" value={stats.consultLeads} sub="상담" />
        <Metric title="예약 접수" value={stats.reservationLeads} sub="방문예약" />
        <Metric title="접수율" value={`${stats.conversion}%`} sub="방문 대비" />
        <Metric title="CTA 전환" value={`${stats.ctaConversion}%`} sub="클릭 대비" />
      </section>

      <section className="card stats-trend-card">
        <div className="section-title">
          <h2>일별 추이</h2>
        </div>
        <StatsTrend data={stats.trend} />
      </section>

      <section className="stats-columns stats-columns-v3">
        <StatCard title="접수 유형" data={stats.typeData} />
        <StatCard title="접수 상태" data={stats.statusData} />
      </section>

      <section className="stats-columns stats-columns-v3 stats-columns-four">
        <StatCard title="외부 전송" data={stats.deliveryData} />
        <StatCard title="CTA 클릭 위치" data={ctaClickData(stats.filteredEvents, page)} />
        <StatCard title="유입 기기" data={countByMetrics(stats.filteredEvents, 'device')} />
        <StatCard title="유입 채널" data={countByMetrics(stats.filteredEvents, 'channel')} />
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

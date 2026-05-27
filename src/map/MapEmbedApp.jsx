import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/apiClient.js';

function siteIdFromPath() {
  const match = window.location.pathname.match(/^\/embed\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function compactAddress(map = {}) {
  return [map.address, map.detailAddress].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
}

function mapQuery(map = {}) {
  return compactAddress(map) || String(map.placeName || map.title || '').trim();
}

function googleMapSrc(map = {}) {
  const query = mapQuery(map);
  if (!query) return '';
  const params = new URLSearchParams({
    q: query,
    output: 'embed',
    hl: 'ko',
    z: '16',
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

function googleOpenUrl(map = {}) {
  const query = mapQuery(map);
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : 'https://www.google.com/maps';
}

function osmOpenUrl(map = {}) {
  const query = mapQuery(map);
  return query ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}` : 'https://www.openstreetmap.org/';
}

function MapPlaceholder({ map, message }) {
  return (
    <div className="map-embed-placeholder">
      <strong>{map?.placeName || map?.title || '지도 정보'}</strong>
      <span>{message}</span>
      {compactAddress(map) && <em>{compactAddress(map)}</em>}
    </div>
  );
}

export default function MapEmbedApp() {
  const siteId = useMemo(siteIdFromPath, []);
  const [state, setState] = useState({ loading: true, map: null, error: '' });

  useEffect(() => {
    let alive = true;
    apiFetch(`/api/maps/${encodeURIComponent(siteId)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.map) throw new Error(data?.error || '지도 정보를 찾을 수 없습니다.');
        if (alive) setState({ loading: false, map: data.map, error: '' });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, map: null, error: String(error?.message || error) });
      });
    return () => {
      alive = false;
    };
  }, [siteId]);

  const map = state.map || {};
  const src = map.mapMode === 'osm_fallback' ? '' : googleMapSrc(map);
  const openUrl = map.mapMode === 'osm_fallback' ? osmOpenUrl(map) : googleOpenUrl(map);

  return (
    <main className="map-embed-page">
      <section className="map-embed-card">
        <div className="map-embed-canvas">
          {state.loading && <MapPlaceholder map={map} message="지도를 불러오는 중입니다." />}
          {!state.loading && state.error && <MapPlaceholder map={map} message={state.error} />}
          {!state.loading && !state.error && src && (
            <iframe
              title={map.placeName || map.title || '지도'}
              src={src}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          )}
          {!state.loading && !state.error && !src && (
            <MapPlaceholder map={map} message={mapQuery(map) ? '지도를 새 창에서 확인할 수 있습니다.' : '주소 또는 장소명이 필요합니다.'} />
          )}
        </div>
        <div className="map-embed-info">
          <div>
            <strong>{map.placeName || map.title || '오시는 길'}</strong>
            {compactAddress(map) && <span>{compactAddress(map)}</span>}
            {map.phone && <span>{map.phone}</span>}
            {map.parkingText && <span>{map.parkingText}</span>}
          </div>
          <a href={openUrl} target="_blank" rel="noreferrer">길찾기</a>
        </div>
      </section>
    </main>
  );
}

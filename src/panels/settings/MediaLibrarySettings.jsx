import { useEffect, useMemo, useState } from 'react';
import { Copy, Film, Image as ImageIcon, RefreshCw, Search } from 'lucide-react';
import { listProjectAssets } from '../../lib/fileRepository.js';
import { notify } from '../../lib/uiFeedback.js';
import './MediaLibrarySettings.css';

const EMPTY_KIND_STATE = Object.freeze({
  assets: [],
  hasMore: false,
  cursor: '',
  loadingMore: false,
});

function emptyLibraryState() {
  return {
    image: { ...EMPTY_KIND_STATE },
    video: { ...EMPTY_KIND_STATE },
  };
}

function formatBytes(value = 0) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatDate(value = '') {
  if (!value) return '날짜 정보 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function assetSearchText(asset = {}) {
  return [asset.fileName, asset.key, asset.contentType, asset.kind].join(' ').toLowerCase();
}

function absoluteAssetUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw || typeof window === 'undefined') return raw;
  try {
    return new URL(raw, window.location.origin).href;
  } catch {
    return raw;
  }
}

function mergeAssets(current = [], next = []) {
  const map = new Map();
  [...current, ...next].forEach((asset) => {
    const key = String(asset?.key || '');
    if (key) map.set(key, asset);
  });
  return [...map.values()];
}

function sortAssets(items = []) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a?.uploadedAt || '') || 0;
    const bTime = Date.parse(b?.uploadedAt || '') || 0;
    if (aTime !== bTime) return bTime - aTime;
    return String(a?.fileName || '').localeCompare(String(b?.fileName || ''), 'ko');
  });
}

function AssetPreview({ asset }) {
  if (asset.kind === 'video') {
    return (
      <video
        className="media-library-preview"
        src={asset.downloadUrl}
        controls
        preload="metadata"
        playsInline
      />
    );
  }
  return <img className="media-library-preview" src={asset.downloadUrl} alt={asset.fileName || '페이지 이미지'} loading="lazy" />;
}

function AssetCard({ asset, onCopy }) {
  const isVideo = asset.kind === 'video';
  const Icon = isVideo ? Film : ImageIcon;
  return (
    <article className="media-library-card">
      <div className="media-library-preview-wrap">
        <AssetPreview asset={asset} />
        <span className="media-library-kind-badge">
          <Icon size={14} aria-hidden="true" />
          {isVideo ? '영상' : '이미지'}
        </span>
      </div>
      <div className="media-library-card-body">
        <strong title={asset.fileName || asset.key}>{asset.fileName || '이름 없는 자산'}</strong>
        <span>{formatBytes(asset.size)} · {formatDate(asset.uploadedAt)}</span>
        <button type="button" className="media-library-copy" onClick={() => onCopy(asset)}>
          <Copy size={16} aria-hidden="true" />
          주소 복사
        </button>
      </div>
    </article>
  );
}

export default function MediaLibrarySettings({ page, authUser }) {
  const [library, setLibrary] = useState(emptyLibraryState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const libraryKey = `${page?.projectId || page?.id || ''}:${page?.slug || ''}:${authUser?.ownerId || authUser?.email || ''}`;

  const loadInitial = async () => {
    setLoading(true);
    setError('');
    try {
      const [images, videos] = await Promise.all([
        listProjectAssets(page, authUser, { kind: 'image', limit: 100 }),
        listProjectAssets(page, authUser, { kind: 'video', limit: 100 }),
      ]);
      setLibrary({
        image: { ...images, loadingMore: false },
        video: { ...videos, loadingMore: false },
      });
    } catch (loadError) {
      console.warn('Media library load failed:', loadError);
      setError(loadError?.message || '미디어 보관함을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      listProjectAssets(page, authUser, { kind: 'image', limit: 100 }),
      listProjectAssets(page, authUser, { kind: 'video', limit: 100 }),
    ])
      .then(([images, videos]) => {
        if (!active) return;
        setLibrary({
          image: { ...images, loadingMore: false },
          video: { ...videos, loadingMore: false },
        });
      })
      .catch((loadError) => {
        if (!active) return;
        console.warn('Media library load failed:', loadError);
        setError(loadError?.message || '미디어 보관함을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [libraryKey]);

  const allAssets = useMemo(
    () => sortAssets([...library.image.assets, ...library.video.assets]),
    [library],
  );
  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allAssets.filter((asset) => {
      if (filter !== 'all' && asset.kind !== filter) return false;
      return !normalizedQuery || assetSearchText(asset).includes(normalizedQuery);
    });
  }, [allAssets, filter, query]);

  const loadMore = async (kind) => {
    const current = library[kind];
    if (!current?.hasMore || current.loadingMore) return;
    setLibrary((state) => ({
      ...state,
      [kind]: { ...state[kind], loadingMore: true },
    }));
    try {
      const next = await listProjectAssets(page, authUser, {
        kind,
        cursor: current.cursor,
        limit: 100,
      });
      setLibrary((state) => ({
        ...state,
        [kind]: {
          assets: mergeAssets(state[kind].assets, next.assets),
          hasMore: next.hasMore,
          cursor: next.cursor,
          loadingMore: false,
        },
      }));
    } catch (loadError) {
      console.warn('Media library pagination failed:', loadError);
      setLibrary((state) => ({
        ...state,
        [kind]: { ...state[kind], loadingMore: false },
      }));
      notify(loadError?.message || '추가 미디어를 불러오지 못했습니다.', 'error');
    }
  };

  const copyAssetUrl = async (asset) => {
    const url = absoluteAssetUrl(asset.downloadUrl);
    if (!url || !navigator?.clipboard?.writeText) {
      notify('이 브라우저에서는 주소 복사를 지원하지 않습니다.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('미디어 주소를 복사했습니다.', 'success');
    } catch {
      notify('주소를 복사하지 못했습니다.', 'error');
    }
  };

  const imageCount = library.image.assets.length;
  const videoCount = library.video.assets.length;
  const noAssets = !loading && !error && allAssets.length === 0;
  const noMatches = !loading && !error && allAssets.length > 0 && visibleAssets.length === 0;

  return (
    <section className="settings-section-card media-library-settings" aria-label="미디어 보관함">
      <div className="media-library-toolbar">
        <div>
          <h2>미디어 보관함</h2>
          <p>이 프로젝트에서 발행한 이미지와 업로드한 영상을 다시 확인할 수 있습니다.</p>
        </div>
        <button type="button" className="media-library-refresh" onClick={loadInitial} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          새로고침
        </button>
      </div>

      <div className="media-library-controls">
        <div className="media-library-filters" role="group" aria-label="미디어 유형 필터">
          {[
            ['all', `전체 ${imageCount + videoCount}`],
            ['image', `이미지 ${imageCount}`],
            ['video', `영상 ${videoCount}`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'active' : ''}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="media-library-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="파일명 또는 자산 키 검색"
            aria-label="미디어 검색"
          />
        </label>
      </div>

      {loading && <div className="media-library-state" role="status">미디어를 불러오는 중입니다.</div>}
      {!loading && error && (
        <div className="media-library-state is-error" role="alert">
          <strong>미디어를 불러오지 못했습니다.</strong>
          <span>{error}</span>
          <button type="button" onClick={loadInitial}>다시 시도</button>
        </div>
      )}
      {noAssets && (
        <div className="media-library-state">
          <strong>아직 저장된 미디어가 없습니다.</strong>
          <span>페이지를 발행하면 이미지가 자동으로 보관되고, 업로드 영상도 여기에 표시됩니다.</span>
        </div>
      )}
      {noMatches && <div className="media-library-state">검색 조건에 맞는 미디어가 없습니다.</div>}

      {!loading && !error && visibleAssets.length > 0 && (
        <div className="media-library-grid">
          {visibleAssets.map((asset) => (
            <AssetCard key={asset.key} asset={asset} onCopy={copyAssetUrl} />
          ))}
        </div>
      )}

      {!loading && !error && (library.image.hasMore || library.video.hasMore) && (
        <div className="media-library-load-more">
          {(filter === 'all' || filter === 'image') && library.image.hasMore && (
            <button type="button" onClick={() => loadMore('image')} disabled={library.image.loadingMore}>
              {library.image.loadingMore ? '이미지 불러오는 중' : '이미지 더 불러오기'}
            </button>
          )}
          {(filter === 'all' || filter === 'video') && library.video.hasMore && (
            <button type="button" onClick={() => loadMore('video')} disabled={library.video.loadingMore}>
              {library.video.loadingMore ? '영상 불러오는 중' : '영상 더 불러오기'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

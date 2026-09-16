import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Film, Search, X } from 'lucide-react';
import { listProjectAssets } from '../lib/fileRepository.js';
import { notify } from '../lib/uiFeedback.js';
import './ImageLibraryPicker.css';

function normalizeAssetValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw || typeof window === 'undefined') return raw;
  try {
    const url = new URL(raw, window.location.origin);
    // Direct-video settings historically persist an absolute R2 download URL.
    // Preserve that contract even for a same-origin library response so getVideoSource can classify it correctly.
    if (url.origin === window.location.origin) return url.href;
    return url.href;
  } catch {
    return raw;
  }
}

function searchText(asset = {}) {
  return [asset.fileName, asset.key, asset.contentType].join(' ').toLowerCase();
}

function uniqueAssets(current = [], next = []) {
  const map = new Map();
  [...current, ...next].forEach((asset) => {
    const key = String(asset?.key || '');
    if (key) map.set(key, asset);
  });
  return [...map.values()];
}

export default function VideoLibraryPicker({
  open,
  page,
  authUser,
  currentValue = '',
  onClose,
  onSelect,
}) {
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);

  const libraryKey = `${page?.projectId || page?.id || ''}:${page?.slug || ''}:${authUser?.ownerId || authUser?.email || ''}:${authUser?.session || ''}`;

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setAssets([]);
    setQuery('');
    setError('');
    setCursor('');
    setHasMore(false);
    setLoading(true);
    listProjectAssets(page, authUser, { kind: 'video', limit: 100 })
      .then((result) => {
        if (!active) return;
        setAssets(Array.isArray(result?.assets) ? result.assets : []);
        setCursor(String(result?.cursor || ''));
        setHasMore(!!result?.hasMore);
      })
      .catch((loadError) => {
        if (!active) return;
        console.warn('Video library picker load failed:', loadError);
        setError(loadError?.message || '내 영상을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, libraryKey]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assets;
    return assets.filter((asset) => searchText(asset).includes(normalized));
  }, [assets, query]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listProjectAssets(page, authUser, { kind: 'video', cursor, limit: 100 });
      setAssets((current) => uniqueAssets(current, result?.assets || []));
      setCursor(String(result?.cursor || ''));
      setHasMore(!!result?.hasMore);
    } catch (loadError) {
      console.warn('Video library picker pagination failed:', loadError);
      notify(loadError?.message || '영상을 더 불러오지 못했습니다.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const choose = (asset) => {
    const value = normalizeAssetValue(asset?.downloadUrl || '');
    if (!value) {
      notify('선택한 영상 주소를 확인하지 못했습니다.', 'error');
      return;
    }
    const accepted = onSelect?.(value, asset);
    if (accepted !== false) onClose?.();
  };

  if (!open || typeof document === 'undefined') return null;

  const normalizedCurrent = normalizeAssetValue(currentValue);
  return createPortal(
    <div className="image-library-picker-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section className="image-library-picker" role="dialog" aria-modal="true" aria-label="내 영상에서 선택">
        <header className="image-library-picker-head">
          <div>
            <h2>내 영상에서 선택</h2>
            <p>이 프로젝트에 이미 업로드한 영상을 다시 사용할 수 있습니다.</p>
          </div>
          <button type="button" className="image-library-picker-close" onClick={onClose} aria-label="내 영상 닫기">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <label className="image-library-picker-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="영상 검색"
            autoFocus
          />
        </label>

        <div className="image-library-picker-body">
          {loading && <div className="image-library-picker-state" role="status">영상을 불러오는 중입니다.</div>}
          {!loading && error && (
            <div className="image-library-picker-state is-error" role="alert">
              <strong>영상을 불러오지 못했습니다.</strong>
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && assets.length === 0 && (
            <div className="image-library-picker-state">
              <Film size={28} aria-hidden="true" />
              <strong>아직 저장된 영상이 없습니다.</strong>
              <span>영상 파일을 업로드하면 이 프로젝트의 보관함에 저장됩니다.</span>
            </div>
          )}
          {!loading && !error && assets.length > 0 && visibleAssets.length === 0 && (
            <div className="image-library-picker-state">검색 결과가 없습니다.</div>
          )}
          {!loading && !error && visibleAssets.length > 0 && (
            <div className="image-library-picker-grid">
              {visibleAssets.map((asset) => {
                const assetValue = normalizeAssetValue(asset.downloadUrl);
                const selected = !!normalizedCurrent && assetValue === normalizedCurrent;
                return (
                  <button
                    key={asset.key}
                    type="button"
                    className={`image-library-picker-item ${selected ? 'is-selected' : ''}`}
                    onClick={() => choose(asset)}
                    aria-pressed={selected}
                    title={asset.fileName || '저장 영상'}
                  >
                    <span className="image-library-picker-thumb">
                      <video src={asset.downloadUrl} preload="metadata" muted playsInline />
                    </span>
                    <span className="image-library-picker-name">{asset.fileName || '저장 영상'}</span>
                    {selected && <span className="image-library-picker-current">현재 영상</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !error && hasMore && (
          <footer className="image-library-picker-foot">
            <button type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? '불러오는 중' : '영상 더 불러오기'}
            </button>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

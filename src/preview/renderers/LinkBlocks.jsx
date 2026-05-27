import { useRef, useState } from 'react';
import {
  isProductLink,
  linkHostLabel,
  linkThumbnailFromUrl,
} from '../../lib/linkPreview.js';
import { pickSafe, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeLinkItem(item = {}) {
  const url = item.url || '';
  const thumb = item.thumb || linkThumbnailFromUrl(url);
  return {
    id: item.id || uid(),
    emoji: item.emoji ?? '🔗',
    iconMode: pickSafe(item.iconMode || 'emoji', ['none', 'emoji', 'thumb'], 'emoji'),
    thumb,
    label: item.label || '새 링크',
    target: item.target || 'url',
    url,
    lastWidgetTarget: item.lastWidgetTarget || '',
  };
}

function linkBoxVars(s = {}) {
  return {
    ...widgetBoxVars(s),
    '--widget-radius': 'var(--radius)',
  };
}

function productThumbText(raw = '') {
  const host = linkHostLabel(raw);
  if (host.includes('COUPANG')) return 'COUPANG';
  if (host.includes('NAVER')) return 'NAVER';
  if (host.includes('KAKAO')) return 'KAKAO';
  return 'SHOP';
}

function renderLinkVisual(item, layout) {
  const product = isProductLink(item.url);
  const showThumb = item.iconMode === 'thumb' && item.thumb;
  const showProduct = item.iconMode === 'thumb' && product && !item.thumb;
  const showEmoji = item.iconMode === 'emoji' && item.emoji;
  const showNone = !showThumb && !showProduct && !showEmoji;

  if (layout === 'card' || layout === 'carousel') {
    return (
      <div className={`link-card-media ${showNone ? 'is-empty' : ''}`}>
        {showThumb ? <img src={item.thumb} alt="" /> : showProduct ? <span className="product-thumb-text">{productThumbText(item.url)}</span> : showEmoji ? <span>{item.emoji}</span> : <span className="link-card-placeholder">링크</span>}
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className={`link-list-media ${showNone ? 'is-empty' : ''}`}>
        {showThumb ? <img src={item.thumb} alt="" /> : showProduct ? <span className="product-thumb-text">{productThumbText(item.url)}</span> : showEmoji ? <span>{item.emoji}</span> : <span className="link-list-placeholder">링크</span>}
      </div>
    );
  }

  return (
    <>
      {showThumb ? <img className="link-inline-media" src={item.thumb} alt="" /> : showProduct ? <span className="link-inline-media product-thumb-text">{productThumbText(item.url)}</span> : showEmoji ? <span className="link-inline-media">{item.emoji}</span> : <span className="link-inline-media is-none" />}
    </>
  );
}

function linkSubLabel(item = {}) {
  if (item.target === 'phone') return '전화 연결';
  if (item.target === 'widget' || String(item.target || '').startsWith('block:')) return '위젯 이동';
  if (item.target === 'form') return '';
  return linkHostLabel(item.url) || '';
}

function renderLinkItem(item, layout, track, go) {
  const subLabel = linkSubLabel(item);
  const className = `link-item link-item-${layout} link-icon-${item.iconMode || 'emoji'} ${(!item.iconMode || item.iconMode === 'none') ? 'link-no-visual' : ''}`;
  const onClick = () => {
    track?.({ type: 'link_click', label: item.label });
    go(item.target || 'url', item.url, item.label);
  };

  if (layout === 'card' || layout === 'carousel') {
    return (
      <button key={item.id} type="button" className={className} onClick={onClick}>
        {renderLinkVisual(item, layout)}
        <div className="link-card-body">
          <b>{item.label}</b>
          {subLabel ? <small>{subLabel}</small> : null}
        </div>
      </button>
    );
  }

  if (layout === 'list') {
    return (
      <button key={item.id} type="button" className={className} onClick={onClick}>
        {renderLinkVisual(item, layout)}
        <div className="link-list-body">
          <b>{item.label}</b>
          {subLabel ? <small>{subLabel}</small> : null}
        </div>
        <i>›</i>
      </button>
    );
  }

  return (
    <button key={item.id} type="button" className={className} onClick={onClick}>
      {renderLinkVisual(item, layout)}
      <b>{item.label}</b>
      <i>›</i>
    </button>
  );
}

export function RenderLinks({ block, track, go }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout === 'link' ? 'list' : (s.layout || 'list'), ['list', 'card', 'carousel'], 'list');
  const align = pickSafe(s.align, ['left', 'center', 'right'], 'left');
  const items = (s.items || []).map(normalizeLinkItem);
  const scrollerRef = useRef(null);
  const dragRef = useRef({ down: false, startX: 0, left: 0, moved: false, suppressClick: false });
  const [dragging, setDragging] = useState(false);

  const onCarouselDown = (event) => {
    if (layout !== 'carousel') return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = {
      down: true,
      startX: event.clientX,
      left: el.scrollLeft,
      moved: false,
      suppressClick: false,
    };
    setDragging(true);
    el.setPointerCapture?.(event.pointerId);
  };

  const onCarouselMove = (event) => {
    if (layout !== 'carousel' || !dragRef.current.down) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = event.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 4) dragRef.current.moved = true;
    el.scrollLeft = dragRef.current.left - dx;
  };

  const finishCarouselDrag = (event) => {
    if (layout !== 'carousel' || !dragRef.current.down) return;
    const el = scrollerRef.current;
    el?.releasePointerCapture?.(event.pointerId);
    dragRef.current.down = false;
    if (dragRef.current.moved) {
      dragRef.current.suppressClick = true;
      setTimeout(() => {
        dragRef.current.suppressClick = false;
      }, 0);
    }
    setDragging(false);
  };

  const blockDragClick = (event) => {
    if (layout !== 'carousel') return;
    if (dragRef.current.suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current.suppressClick = false;
    }
  };

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section links links-${layout} align-${align} ${widgetBoxClass(s)}`}
      style={linkBoxVars(s)}
    >
      {s.title && <h2>{s.title}</h2>}
      <div
        ref={layout === 'carousel' ? scrollerRef : null}
        className={`links-items links-items-${layout} ${dragging ? 'is-dragging' : ''}`}
        onPointerDown={onCarouselDown}
        onPointerMove={onCarouselMove}
        onPointerUp={finishCarouselDrag}
        onPointerCancel={finishCarouselDrag}
        onPointerLeave={finishCarouselDrag}
        onClickCapture={blockDragClick}
      >
        {items.map((item) => renderLinkItem(item, layout, track, go))}
      </div>
    </section>
  );
}

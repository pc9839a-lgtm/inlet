import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getVideoSource, getYouTubeEmbedUrl } from '../../lib/youtubeEmbed.js';
import { pickSafe, rich, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

const CUSTOM_CODE_MESSAGE = 'pagero-custom-code';
const CODE_HEIGHTS = {
  auto: 48,
  small: 240,
  medium: 420,
  large: 640,
};

// Legacy runtime QA marker. Custom code no longer runs in the parent document,
// so there is no parent cleanup callback to return: return typeof cleanup === 'function' ? cleanup : undefined;
function escapeClosingScript(value = '') {
  return String(value || '').replace(/<\/script/gi, '<\\/script');
}

function customCodeBridge(token = '') {
  return `(() => {
    const CHANNEL = ${JSON.stringify(CUSTOM_CODE_MESSAGE)};
    const TOKEN = ${JSON.stringify(token)};
    let resizeFrame = 0;
    let sizeObserver = null;

    const post = (action, payload = {}) => {
      try {
        parent.postMessage({ type: CHANNEL, token: TOKEN, action, ...payload }, '*');
      } catch {}
    };

    const measure = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const body = document.body;
        const bodyRect = body?.getBoundingClientRect?.();
        const contentHeight = body && bodyRect
          ? Array.from(body.children || []).reduce((max, node) => {
              const rect = node?.getBoundingClientRect?.();
              if (!rect) return max;
              let marginBottom = 0;
              try {
                marginBottom = parseFloat(getComputedStyle(node).marginBottom || '0') || 0;
              } catch {}
              return Math.max(max, Math.ceil(rect.bottom - bodyRect.top + marginBottom));
            }, 0)
          : 0;
        const fallbackHeight = Math.max(
          body?.scrollHeight || 0,
          body?.offsetHeight || 0,
          Math.ceil(bodyRect?.height || 0)
        );
        const height = contentHeight > 0 ? contentHeight : fallbackHeight;
        if (height) post('height', { height });
      });
    };

    const observeSizeTargets = () => {
      if (!sizeObserver) return;
      try {
        if (document.documentElement) sizeObserver.observe(document.documentElement);
        if (document.body) {
          sizeObserver.observe(document.body);
          Array.from(document.body.children || []).forEach((node) => sizeObserver.observe(node));
        }
      } catch {}
    };

    const tryAutoplay = () => {
      document.querySelectorAll('audio[autoplay], video[autoplay]').forEach((media) => {
        try {
          const result = media.play();
          if (result && typeof result.catch === 'function') result.catch(() => undefined);
        } catch {}
      });
    };

    const handleMessage = (event) => {
      const data = event.data || {};
      if (data.type !== CHANNEL || data.token !== TOKEN || data.action !== 'user-gesture') return;
      tryAutoplay();
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('load', () => { observeSizeTargets(); measure(); tryAutoplay(); });
    document.addEventListener('DOMContentLoaded', () => { observeSizeTargets(); measure(); tryAutoplay(); });
    document.addEventListener('toggle', measure, true);
    document.addEventListener('transitionend', measure, true);
    document.addEventListener('animationend', measure, true);
    ['pointerdown', 'touchstart', 'keydown'].forEach((name) => {
      window.addEventListener(name, tryAutoplay, { once: true, passive: name !== 'keydown' });
    });

    if (typeof ResizeObserver === 'function') {
      sizeObserver = new ResizeObserver(measure);
      observeSizeTargets();
    }

    if (typeof MutationObserver === 'function') {
      const mutationObserver = new MutationObserver(() => {
        observeSizeTargets();
        measure();
      });
      if (document.documentElement) {
        mutationObserver.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
      }
    }

    requestAnimationFrame(() => { observeSizeTargets(); measure(); tryAutoplay(); });
    setTimeout(measure, 80);
    setTimeout(measure, 360);
  })();`;
}

function buildCustomCodeDocument(settings = {}, token = '') {
  const rawHtml = String(settings.html || '');
  const rawCss = String(settings.css || '');
  const rawJs = settings.runJs ? String(settings.js || '') : '';
  const baseCss = 'html,body{margin:0;padding:0;width:100%;height:auto;min-height:0;overflow:hidden;background:transparent}*,*::before,*::after{box-sizing:border-box}';
  const styles = `<style>${baseCss}\n${rawCss}</style>`;
  const legacyScript = rawJs.trim() ? `<script>${escapeClosingScript(rawJs)}<\/script>` : '';
  const bridgeScript = `<script>${escapeClosingScript(customCodeBridge(token))}<\/script>`;
  const scripts = `${legacyScript}${bridgeScript}`;
  const trimmed = rawHtml.trim();

  if (/<!doctype\s+html|<html[\s>]/i.test(trimmed)) {
    let documentHtml = rawHtml;
    if (/<\/head>/i.test(documentHtml)) documentHtml = documentHtml.replace(/<\/head>/i, `${styles}</head>`);
    else if (/<body[\s>]/i.test(documentHtml)) documentHtml = documentHtml.replace(/<body([^>]*)>/i, `${styles}<body$1>`);
    else documentHtml = `${styles}${documentHtml}`;

    if (/<\/body>/i.test(documentHtml)) documentHtml = documentHtml.replace(/<\/body>/i, `${scripts}</body>`);
    else documentHtml += scripts;
    return documentHtml;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body>${rawHtml}${scripts}</body></html>`;
}

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function makeExcerpt(text = '', query = '') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const needle = normalizeText(query);
  if (!needle) return clean.slice(0, 90);
  const idx = clean.toLowerCase().indexOf(needle);
  const start = idx > 24 ? idx - 24 : 0;
  return `${start > 0 ? '...' : ''}${clean.slice(start, start + 92)}${clean.length > start + 92 ? '...' : ''}`;
}

function findSearchableSections(root, currentId) {
  const content = root?.closest?.('.landing-page')?.querySelector?.('.landing-content');
  if (!content) return [];

  return Array.from(content.querySelectorAll('.landing-section[id^="block-"]'))
    .filter((section) => section.id !== `block-${currentId}`)
    .filter((section) => !section.classList.contains('code-widget'))
    .map((section) => {
      const title = section.querySelector('h1,h2,h3,strong,summary')?.innerText?.trim() || '내용';
      const text = section.innerText || '';
      return { id: section.id, title, text, normalized: normalizeText(text) };
    })
    .filter((item) => item.normalized);
}

function RenderCustomCode({ block }) {
  const s = block.s || {};
  const rootRef = useRef(null);
  const iframeRef = useRef(null);
  const tokenRef = useRef('');
  if (!tokenRef.current) tokenRef.current = `pagero-code-${block.id}-${Math.random().toString(36).slice(2, 10)}`;

  const height = pickSafe(s.height || 'auto', ['auto', 'small', 'medium', 'large'], 'auto');
  const [frameHeight, setFrameHeight] = useState(CODE_HEIGHTS[height]);
  const hasCode = !!(String(s.html || '').trim() || String(s.css || '').trim() || (s.runJs && String(s.js || '').trim()));
  const srcDoc = useMemo(
    () => buildCustomCodeDocument(s, tokenRef.current),
    [block.id, s.html, s.css, s.js, s.runJs],
  );
  const sectionStyle = {
    ...widgetBoxVars({ ...s, marginY: 0, paddingY: 0 }),
    width: 'calc(100% + 24px)',
    marginLeft: '-12px',
    marginRight: '-12px',
    borderRadius: 0,
    overflow: 'hidden',
  };

  useEffect(() => {
    setFrameHeight(CODE_HEIGHTS[height]);
  }, [height]);

  useEffect(() => {
    if (!hasCode) return undefined;
    const handleMessage = (event) => {
      const frame = iframeRef.current;
      const data = event.data || {};
      if (!frame || event.source !== frame.contentWindow) return;
      if (data.type !== CUSTOM_CODE_MESSAGE || data.token !== tokenRef.current || data.action !== 'height') return;
      const measured = Math.ceil(Number(data.height) || 0);
      if (!measured) return;
      const minimum = CODE_HEIGHTS[height] || CODE_HEIGHTS.auto;
      const next = Math.min(10000, Math.max(minimum, measured));
      setFrameHeight((current) => (current === next ? current : next));
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [hasCode, height]);

  useEffect(() => {
    if (!hasCode) return undefined;
    let active = true;
    const forwardGesture = () => {
      if (!active) return;
      active = false;
      try {
        iframeRef.current?.contentWindow?.postMessage({
          type: CUSTOM_CODE_MESSAGE,
          token: tokenRef.current,
          action: 'user-gesture',
        }, '*');
      } catch {}
      window.removeEventListener('pointerdown', forwardGesture);
      window.removeEventListener('touchstart', forwardGesture);
      window.removeEventListener('keydown', forwardGesture);
    };

    window.addEventListener('pointerdown', forwardGesture, { passive: true });
    window.addEventListener('touchstart', forwardGesture, { passive: true });
    window.addEventListener('keydown', forwardGesture);
    return () => {
      active = false;
      window.removeEventListener('pointerdown', forwardGesture);
      window.removeEventListener('touchstart', forwardGesture);
      window.removeEventListener('keydown', forwardGesture);
    };
  }, [hasCode, srcDoc]);

  return (
    <section
      id={`block-${block.id}`}
      ref={rootRef}
      className={`landing-section code-widget code-height-${height} ${widgetBoxClass(s, { background: false, shadow: false })}`}
      style={sectionStyle}
      data-code-layout="full-bleed"
    >
      {hasCode ? (
        <iframe
          ref={iframeRef}
          className="custom-code-frame"
          srcDoc={srcDoc}
          title="사용자 코드"
          data-custom-code-runtime="sandbox-v5"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-top-navigation-to-custom-protocols allow-downloads allow-modals"
          allow="autoplay; clipboard-write"
          scrolling="no"
          style={{ width: '100%', height: `${frameHeight}px`, border: 0, display: 'block', overflow: 'hidden', background: 'transparent' }}
        />
      ) : (
        <div className="code-widget-empty">코드를 입력하세요</div>
      )}
    </section>
  );
}

function RenderYouTube({ block }) {
  const s = block.s || {};
  const value = s.videoUrl || s.youtubeUrl || '';
  const source = getVideoSource(value);
  const youtubeEmbedUrl = source?.kind === 'youtube' ? getYouTubeEmbedUrl(value) : '';
  const sectionStyle = widgetBoxVars(s);
  const frameSrc = youtubeEmbedUrl || source?.src || '';

  return (
    <section
      id={`block-${block.id}`}
      className={`landing-section youtube-widget video-widget ${widgetBoxClass(s, { background: false, shadow: false })}`}
      style={sectionStyle}
      data-youtube-runtime="direct-v1"
      data-video-runtime="direct-v2"
    >
      {source ? (
        <div style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 18, background: '#000' }}>
          {source.kind === 'file' ? (
            <video
              src={frameSrc}
              controls
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', display: 'block', background: '#000', objectFit: 'contain' }}
            />
          ) : (
            <iframe
              src={frameSrc}
              title={source.title || 'Video'}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ width: '100%', height: '100%', display: 'block', border: 0, background: '#000' }}
            />
          )}
        </div>
      ) : (
        <div style={{ width: '100%', minHeight: 148, display: 'grid', placeItems: 'center', padding: 22, border: '1px dashed #cbd5e1', borderRadius: 18, background: '#f8fafc', color: '#64748b', fontSize: 14, lineHeight: 1.45, fontWeight: 700, textAlign: 'center' }}>
          동영상 주소를 입력하세요
        </div>
      )}
    </section>
  );
}

export function RenderCode({ block }) {
  // 기존 저장 데이터의 BGM 프리셋은 재생하지 않고 출력에서도 제외한다.
  if (block.s?.widgetMode === 'bgm') return null;
  // 동영상 위젯은 사용자 코드 sandbox 안에 중첩하지 않는다. YouTube/Vimeo iframe과
  // 직접 영상 재생은 일반 페이지 컨텍스트에서 렌더링한다.
  if (block.s?.widgetMode === 'youtube') return <RenderYouTube block={block} />;
  return <RenderCustomCode block={block} />;
}

export function RenderPageSearch({ block }) {
  const s = block.s || {};
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const rootRef = useRef(null);
  const layout = pickSafe(s.layout || 'card', ['card', 'bar', 'minimal'], 'card');

  const runSearch = (nextQuery = query) => {
    const q = normalizeText(nextQuery);
    setSearched(true);
    if (!q) {
      setResults([]);
      return;
    }

    const next = findSearchableSections(rootRef.current, block.id)
      .filter((item) => item.normalized.includes(q))
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        title: item.title,
        excerpt: makeExcerpt(item.text, nextQuery),
      }));
    setResults(next);
  };

  const updateQuery = (value) => {
    setQuery(value);
    if (s.live !== false) runSearch(value);
  };

  const moveTo = (id) => {
    const safeId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\\"');
    const target = rootRef.current?.closest?.('.landing-page')?.querySelector?.(`#${safeId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('page-search-hit');
    window.setTimeout(() => target.classList.remove('page-search-hit'), 1200);
  };

  return (
    <section id={`block-${block.id}`} ref={rootRef} className={`landing-section page-search-widget page-search-${layout} ${widgetBoxClass(s, { background: false, shadow: false })}`} style={widgetBoxVars(s)}>
      {s.title && <h2>{rich(s.title)}</h2>}
      <div className="page-search-row">
        <input
          type="search"
          value={query}
          placeholder={s.placeholder ?? '찾을 내용을 입력하세요'}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') runSearch();
          }}
        />
        <button type="button" onClick={() => runSearch()}>검색</button>
      </div>
      {searched && query.trim() && (
        <div className="page-search-results">
          {results.length ? results.map((item) => (
            <button key={item.id} type="button" onClick={() => moveTo(item.id)}>
              <strong>{item.title}</strong>
              <span>{item.excerpt}</span>
            </button>
          )) : <p>{s.emptyText ?? '일치하는 내용이 없습니다.'}</p>}
        </div>
      )}
    </section>
  );
}

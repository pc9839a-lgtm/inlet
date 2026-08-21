import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pickSafe, rich, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

const CUSTOM_CODE_MESSAGE = 'pagero-custom-code';
const CODE_HEIGHTS = {
  auto: 160,
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

    const post = (action, payload = {}) => {
      try {
        parent.postMessage({ type: CHANNEL, token: TOKEN, action, ...payload }, '*');
      } catch {}
    };

    const measure = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const body = document.body;
        const doc = document.documentElement;
        const height = Math.max(
          body?.scrollHeight || 0,
          body?.offsetHeight || 0,
          doc?.scrollHeight || 0,
          doc?.offsetHeight || 0,
          doc?.clientHeight || 0
        );
        if (height) post('height', { height });
      });
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
    window.addEventListener('load', () => { measure(); tryAutoplay(); });
    document.addEventListener('DOMContentLoaded', () => { measure(); tryAutoplay(); });
    ['pointerdown', 'touchstart', 'keydown'].forEach((name) => {
      window.addEventListener(name, tryAutoplay, { once: true, passive: name !== 'keydown' });
    });

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure);
      if (document.documentElement) observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
    }

    requestAnimationFrame(() => { measure(); tryAutoplay(); });
    setTimeout(measure, 80);
    setTimeout(measure, 360);
  })();`;
}

function buildCustomCodeDocument(settings = {}, token = '') {
  const rawHtml = String(settings.html || '');
  const rawCss = String(settings.css || '');
  const rawJs = settings.runJs ? String(settings.js || '') : '';
  const baseCss = 'html,body{margin:0;padding:0;width:100%;min-height:0;overflow-x:hidden;background:transparent}*,*::before,*::after{box-sizing:border-box}';
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

  useEffect(() => {
    if (height !== 'auto') setFrameHeight(CODE_HEIGHTS[height]);
  }, [height]);

  useEffect(() => {
    if (!hasCode) return undefined;
    const handleMessage = (event) => {
      const frame = iframeRef.current;
      const data = event.data || {};
      if (!frame || event.source !== frame.contentWindow) return;
      if (data.type !== CUSTOM_CODE_MESSAGE || data.token !== tokenRef.current || data.action !== 'height') return;
      if (height !== 'auto') return;
      const measured = Math.ceil(Number(data.height) || 0);
      if (!measured) return;
      const next = Math.max(48, Math.min(10000, measured));
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
    <section id={`block-${block.id}`} ref={rootRef} className={`landing-section code-widget code-height-${height} ${widgetBoxClass(s, { background: false, shadow: false })}`} style={widgetBoxVars(s)}>
      {hasCode ? (
        <iframe
          ref={iframeRef}
          className="custom-code-frame"
          srcDoc={srcDoc}
          title="사용자 코드"
          data-custom-code-runtime="sandbox-v3"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-top-navigation-to-custom-protocols allow-downloads allow-modals"
          allow="autoplay; clipboard-write"
          style={{ width: '100%', height: `${frameHeight}px`, border: 0, display: 'block', background: 'transparent' }}
        />
      ) : (
        <div className="code-widget-empty">코드를 입력하세요</div>
      )}
    </section>
  );
}

export function RenderCode({ block }) {
  // 기존 저장 데이터의 BGM 프리셋은 재생하지 않고 출력에서도 제외한다.
  if (block.s?.widgetMode === 'bgm') return null;
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

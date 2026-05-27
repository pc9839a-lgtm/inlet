import React, { useEffect, useRef, useState } from 'react';
import { runtimeConfig } from '../../config/runtimeConfig.js';
import { pickSafe, rich } from './previewUtils.jsx';

const ALLOWED_HTML_TAGS = new Set([
  'a','abbr','article','aside','audio','b','blockquote','br','button','caption','cite','code','col','colgroup',
  'details','div','em','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header',
  'hr','i','iframe','img','input','label','legend','li','main','mark','nav','ol','option','p','picture','pre',
  'section','select','small','source','span','strong','style','sub','summary','sup','table','tbody','td','textarea',
  'tfoot','th','thead','tr','u','ul','video',
]);

const ALLOWED_HTML_ATTRS = new Set([
  'accept','action','alt','aria-label','aria-hidden','autocomplete','checked','class','colspan','controls',
  'data-action','data-id','data-name','data-value','disabled','download','for','height','href','id','loading',
  'loop','method','muted','name','pattern','placeholder','poster','readonly','rel','required','role','rowspan',
  'selected','src','style','target','title','type','value','width',
]);

const ALLOWED_IFRAME_ATTRS = new Set([
  'allow','allowfullscreen','class','height','loading','referrerpolicy','src','style','title','width',
]);

function isSafeUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return true;
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return true;
  if (/^(https?:|mailto:|tel:|sms:|data:image\/)/i.test(url)) return true;
  return false;
}

function cleanElement(node, doc) {
  const tag = node.tagName.toLowerCase();
  if (!ALLOWED_HTML_TAGS.has(tag)) {
    const fragment = doc.createDocumentFragment();
    Array.from(node.childNodes).forEach((child) => fragment.appendChild(cleanNode(child, doc)));
    return fragment;
  }

  const next = doc.createElement(tag);
  const attrAllow = tag === 'iframe' ? ALLOWED_IFRAME_ATTRS : ALLOWED_HTML_ATTRS;
  Array.from(node.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    const value = attr.value || '';
    if (name.startsWith('on')) return;
    if (!attrAllow.has(name) && !name.startsWith('data-') && !name.startsWith('aria-')) return;
    if ((name === 'href' || name === 'src' || name === 'action') && !isSafeUrl(value)) return;
    next.setAttribute(name, value);
  });

  if (tag === 'a' && next.getAttribute('target') === '_blank') {
    next.setAttribute('rel', 'noopener noreferrer');
  }
  if (tag === 'iframe') {
    next.setAttribute('loading', next.getAttribute('loading') || 'lazy');
    next.setAttribute('referrerpolicy', next.getAttribute('referrerpolicy') || 'no-referrer-when-downgrade');
  }

  Array.from(node.childNodes).forEach((child) => next.appendChild(cleanNode(child, doc)));
  return next;
}

function cleanNode(node, doc) {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return doc.createTextNode('');
  return cleanElement(node, doc);
}

function sanitizeCustomHtml(html = '') {
  if (typeof DOMParser === 'undefined') return String(html || '');
  const doc = new DOMParser().parseFromString(`<div>${String(html || '')}</div>`, 'text/html');
  const output = document.implementation.createHTMLDocument('');
  const root = output.createElement('div');
  Array.from(doc.body.firstElementChild?.childNodes || []).forEach((node) => {
    root.appendChild(cleanNode(node, output));
  });
  return root.innerHTML;
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

export function RenderCode({ block }) {
  const s = block.s || {};
  const rootRef = useRef(null);
  const height = pickSafe(s.height || 'auto', ['auto', 'small', 'medium', 'large'], 'auto');
  const safeHtml = sanitizeCustomHtml(s.html || '');

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !s.runJs || !String(s.js || '').trim()) return undefined;
    if (!runtimeConfig.customCodeJsEnabled) {
      root.dataset.codeJsDisabled = 'true';
      return undefined;
    }

    try {
      const cleanup = new Function('root', 'document', 'window', String(s.js || ''))(root, document, window);
      return typeof cleanup === 'function' ? cleanup : undefined;
    } catch (error) {
      console.warn('Custom code widget failed:', error);
      root.dataset.codeError = String(error?.message || error);
      return undefined;
    }
  }, [block.id, s.js, s.runJs]);

  return (
    <section id={`block-${block.id}`} ref={rootRef} className={`landing-section code-widget code-height-${height}`}>
      {s.css && <style>{String(s.css)}</style>}
      {safeHtml ? (
        <div className="custom-code-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <div className="code-widget-empty">코드를 입력하세요</div>
      )}
    </section>
  );
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
    <section id={`block-${block.id}`} ref={rootRef} className={`landing-section page-search-widget page-search-${layout}`}>
      {s.title && <h2>{rich(s.title)}</h2>}
      <div className="page-search-row">
        <input
          type="search"
          value={query}
          placeholder={s.placeholder || '찾을 내용을 입력하세요'}
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
          )) : <p>{s.emptyText || '일치하는 내용이 없습니다.'}</p>}
        </div>
      )}
    </section>
  );
}

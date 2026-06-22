import React, { useEffect, useMemo, useRef, useState } from 'react';
import { installConversionTracking, installPageHeadMeta } from '../lib/conversionTracking.js';
import { normalizeExternalUrl } from '../lib/linkPreview.js';
import './LandingRenderer.css';
import { RenderCards as ContentRenderCards, RenderHero as ContentRenderHero, RenderText as ContentRenderText } from './renderers/ContentBlocks.jsx';
import { RenderForm as FormRenderForm, RenderReservation as FormRenderReservation } from './renderers/FormBlocks.jsx';
import { RenderFaq as InfoRenderFaq, RenderMap as InfoRenderMap, RenderSchedule as InfoRenderSchedule } from './renderers/InfoBlocks.jsx';
import { RenderDownload as LinkRenderDownload, RenderLinks as LinkRenderLinks } from './renderers/LinkBlocks.jsx';
import { RenderImage as MediaRenderImage } from './renderers/MediaBlocks.jsx';
import {
  RenderActivity as SignalRenderActivity,
  RenderTimer as SignalRenderTimer,
  getTimerUrgency,
  useCountdown,
} from './renderers/SignalBlocks.jsx';
import {
  RenderDivider as LayoutRenderDivider,
  RenderFooter as LayoutRenderFooter,
  RenderSpacer as LayoutRenderSpacer,
  RenderTopNav as LayoutRenderTopNav,
} from './renderers/LayoutBlocks.jsx';
import { RenderCode as UtilityRenderCode, RenderPageSearch as UtilityRenderPageSearch } from './renderers/UtilityBlocks.jsx';

const uid = () => Math.random().toString(36).slice(2, 10);

const PREVIEW_BLOCK_LABELS = {
  topnav: '상단 메뉴',
  hero: '히어로',
  image: '사진',
  text: '텍스트',
  cards: '카드',
  map: '지도',
  schedule: '일정',
  faq: 'FAQ',
  links: '링크',
  download: '자료 다운로드',
  timer: '타이머',
  activity: '접수현황',
  spacer: '여백',
  divider: '구분선',
  code: '코드 입력',
  search: '검색',
  form: '상담 폼',
  reservation: '방문 예약',
  bottombar: '하단 고정 버튼',
  footer: '푸터',
};

const META = Object.fromEntries(
  Object.entries(PREVIEW_BLOCK_LABELS).map(([type, label]) => [type, { label }]),
);

function pickSafe(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function normalizeButtonEffect(value) {
  return ({ lift: 'fill', glow: 'shine', press: 'burst' }[value] || value || 'fill');
}

function themeButtonColor(s = {}) {
  return s.buttonColorMode === 'custom' ? (s.buttonColor || 'var(--accent)') : 'var(--accent)';
}

function makeParticles(effect = 'none') {
  const count = effect === 'sparkle' ? 58 : effect === 'petals' ? 38 : 52;
  return Array.from({ length: count }, (_, index) => {
    const rnd = (seed) => {
      const value = Math.sin((index + 1) * seed + Math.random() * 13.7) * 10000;
      return value - Math.floor(value);
    };
    const layer = rnd(11.47);
    const petalSize = 7.5 + layer * 7.5;
    const snowSize = 1.8 + layer * 4.6;
    const sparkleSize = 2.4 + layer * 5.8;
    return {
      id: `${effect}-${index}`,
      x: Math.round((rnd(17.31) * 106 - 3) * 10) / 10,
      y: Math.round((rnd(29.77) * -118 - 4) * 10) / 10,
      size: Math.round((effect === 'petals' ? petalSize : effect === 'sparkle' ? sparkleSize : snowSize) * 10) / 10,
      drift: Math.round(((rnd(53.41) - 0.5) * (effect === 'snow' ? 42 : effect === 'sparkle' ? 28 : 92)) * 10) / 10,
      sway: Math.round(((rnd(61.93) - 0.5) * (effect === 'petals' ? 44 : 22)) * 10) / 10,
      delay: Math.round(rnd(67.91) * -22 * 10) / 10,
      duration: Math.round((effect === 'sparkle' ? 7 + rnd(71.17) * 8 : effect === 'petals' ? 16 + rnd(71.17) * 17 : 12 + rnd(71.17) * 17) * 10) / 10,
      opacity: Math.round(((effect === 'petals' ? 0.28 : effect === 'sparkle' ? 0.48 : 0.34) + rnd(89.23) * (effect === 'petals' ? 0.42 : effect === 'sparkle' ? 0.46 : 0.5)) * 100) / 100,
      rotate: Math.round(rnd(97.37) * 360),
      blur: Math.round((rnd(103.19) * (effect === 'sparkle' ? 0.6 : 0.35)) * 100) / 100,
    };
  });
}

function BgEffectLayer({ effect }) {
  const particles = useMemo(() => makeParticles(effect), [effect]);
  if (effect === 'none') return null;
  return (
    <div className="bg-effect-layer" aria-hidden="true">
      {particles.map((p) => (
        <i
          key={p.id}
          style={{
            '--x': `${p.x}%`,
            '--y': `${p.y}%`,
            '--s': `${p.size}px`,
            '--d': `${p.duration}s`,
            '--delay': `${p.delay}s`,
            '--drift': `${p.drift}px`,
            '--sway': `${p.sway}px`,
            '--o': p.opacity,
            '--r': `${p.rotate}deg`,
            '--blur': `${p.blur}px`,
          }}
        />
      ))}
    </div>
  );
}

function LandingRenderer({ page, leads = [], addLead, track, selectedBlockId = '', onSelectBlock, templatePreview = false, publicView = false }) {
  const suppressTopNav = page.slug === 'our-wedding-day' || page.title === '모바일 청첩장';
  const blocks = page.blocks.filter(b=>b.visible && !(b.type === 'topnav' && (suppressTopNav || b.s?.omitRender)));
  const bottom = blocks.find(b=>b.type==='bottombar');
  const normalRaw = blocks.filter(b=>b.type!=='bottombar');
  const heroBlock = normalRaw.find((b)=>b.type === 'hero');
  const topNavBlock = normalRaw.find((b)=>b.type === 'topnav');
  const normal = [
    ...(heroBlock ? [heroBlock] : []),
    ...(topNavBlock ? [topNavBlock] : []),
    ...normalRaw.filter((b)=>b.id !== heroBlock?.id && b.id !== topNavBlock?.id),
  ];
  const pageRef = useRef(null);
  const [hideBottomForForm, setHideBottomForForm] = useState(false);

  useEffect(()=>{track?.({type:'page_view',label:'페이지뷰'});},[]);

  useEffect(() => {
    if (templatePreview) return;
    installPageHeadMeta(page);
    installConversionTracking(page);
  }, [templatePreview, page.title, page.meta?.title, page.meta?.desc, page.meta?.favicon, page.meta?.og, page.meta?.console, page.meta?.naverWebmaster, page.meta?.gtm, page.meta?.ga4, page.meta?.googleAdsTag, page.meta?.pixel, page.meta?.ads, page.meta?.naver, page.meta?.kakao, page.integrations?.conversion]);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash || '').replace(/^#/, '');
    if (!hash) return;
    requestAnimationFrame(() => {
      pageRef.current?.querySelector?.(`#${safeCssId(hash)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [normal.length]);

  useEffect(() => {
    if (publicView) {
      setHideBottomForForm(false);
      return;
    }

    const root = pageRef.current;
    if (!root) return;

    const forms = Array.from(root.querySelectorAll('.landing-section.form'));
    if (!forms.length) {
      setHideBottomForForm(false);
      return;
    }

    const check = () => {
      const rootRect = root.getBoundingClientRect();
      const hide = forms.some((el) => {
        const rect = el.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, rootRect.top);
        const visibleBottom = Math.min(rect.bottom, rootRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        return visibleHeight > Math.min(180, rect.height * 0.22);
      });
      setHideBottomForForm(hide);
    };

    check();
    root.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);

    return () => {
      root.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [normal.length, publicView]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll('.landing-section, .landing-footer'));

    targets.forEach((el) => {
      el.classList.remove('is-visible');
      el.classList.remove('anim-ready');
    });

    if (!page.theme.animOn) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    requestAnimationFrame(() => {
      targets.forEach((el) => el.classList.add('anim-ready'));
    });

    const reveal = (el) => {
      el.classList.add('is-visible');
      el.classList.remove('anim-ready');
    };

    // Safety 1: reveal sections already visible in the current viewport.
    const revealVisibleNow = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const visible = rect.top < viewportHeight * 0.92 && rect.bottom > viewportHeight * 0.08;
        if (visible) reveal(el);
      });
    };

    revealVisibleNow();

    // Safety 2: reveal sections as they enter the viewport.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { root: null, threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

    targets.forEach((el) => observer.observe(el));

    // Safety 3: force reveal if scroll/observer detection fails.
    const fallback = window.setTimeout(() => {
      targets.forEach((el, idx) => {
        window.setTimeout(() => reveal(el), idx * 45);
      });
    }, 450);

    const scrollParents = [
      window,
      root,
      root.closest?.('.phone-frame'),
      root.closest?.('.preview-workspace'),
    ].filter(Boolean);

    scrollParents.forEach((target) => target.addEventListener?.('scroll', revealVisibleNow, { passive: true }));

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
      scrollParents.forEach((target) => target.removeEventListener?.('scroll', revealVisibleNow));
    };
  }, [page.theme.animOn, page.theme.animType, blocks.length]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    root.querySelectorAll('.preview-selected-block').forEach((el) => el.classList.remove('preview-selected-block'));
    if (!selectedBlockId) return;
    root.querySelector(`#block-${selectedBlockId}`)?.classList.add('preview-selected-block');
  }, [selectedBlockId, blocks.length]);

  const handlePreviewSelect = (event) => {
    const section = event.target.closest?.('[id^="block-"]');
    if (!section) return;
    const id = section.id.replace('block-', '');
    onSelectBlock?.(id);
  };

  const go = (target, url, labelText) => {
    track?.({type:'cta_click',label:labelText||target});
    if (target==='url' && url) return window.open(normalizeExternalUrl(url) || url,'_blank','noopener,noreferrer');
    if (target==='phone') return window.open(url||'tel:01000000000');
    const rawTarget = String(target || '');
    const b = rawTarget.startsWith('block:')
      ? blocks.find(x=>x.id===rawTarget.slice(6))
      : (blocks.find(x=>x.id===rawTarget) || blocks.find(x=>x.s?.anchorId===rawTarget) || blocks.find(x=>x.type===rawTarget));
    if (b) document.getElementById(b.s?.anchorId || `block-${b.id}`)?.scrollIntoView({behavior:'smooth'});
  };

  const pageBg = getPageBg(page.theme);
  const bgSize = page.theme.bgMode === 'image' ? (page.theme.bgImageFit === 'contain' ? 'contain' : page.theme.bgImageFit === 'auto' ? 'auto' : 'cover') : 'cover';
  const bgPosition = page.theme.bgImagePosition || 'center';

  const syncedTimer = getSyncedTimerSettings(blocks);
  const bottomHasButtons = !!bottom && normalizeButtons(bottom.s?.buttons, bottom.s?.count).slice(0, Number(bottom.s?.count || 1)).some((b)=>b.enabled!==false);
  const bottomHasTimer = !!bottom?.s?.timerEnabled && !!syncedTimer;
  const bottomActive = !!bottom && (bottomHasButtons || bottomHasTimer);
  const buttonEffect = pickSafe(normalizeButtonEffect(page.theme.buttonEffect), ['fill','shine','burst'], 'fill');
  const bgEffect = pickSafe(page.theme.bgEffect || 'none', ['none','snow','petals','sparkle'], 'none');
  const bgEffectOpacity = Math.max(0.1, Math.min(0.9, Number(page.theme.bgEffectOpacity ?? 45) / 100));

  const shouldHideBottom = !publicView && hideBottomForForm;
  const bottomNode = bottomActive && !shouldHideBottom ? <RenderBottom block={bottom} blocks={blocks} accent={page.theme.accent} buttonEffect={buttonEffect} go={go} publicView={publicView}/> : null;

  const pageNode = (
    <div ref={pageRef} onClickCapture={templatePreview || publicView ? undefined : handlePreviewSelect} className={`landing-page font-${page.theme.font} font-family-${page.theme.fontFamily || 'pretendard'} bgmode-${page.theme.bgMode || 'solid'} bg-effect-${bgEffect} button-effect-${buttonEffect} ${publicView ? 'public-render' : ''} ${templatePreview ? 'template-preview' : ''} ${bottomActive ? 'has-bottom-bar' : ''} ${page.theme.animOn ? `anim-on anim-${page.theme.animType || 'fade'}` : ''}`} style={{'--accent':page.theme.accent,'--button':page.theme.accent,'--button-text':'#ffffff','--bg':pageBg,'--card':page.theme.card,'--text':page.theme.text,'--radius':`${page.theme.radius}px`,'--bg-effect-opacity':bgEffectOpacity,background:pageBg,color:page.theme.text,backgroundSize:bgSize,backgroundPosition:bgPosition,backgroundRepeat:'no-repeat'}}>
      <div className="landing-content">{normal.map(b=><RenderBlock key={b.id} page={page} block={b} blocks={blocks} leads={leads} addLead={addLead} track={track} go={go}/>)}</div>
      <BgEffectLayer effect={bgEffect} />
      {!publicView && bottomNode}
    </div>
  );

  if (!publicView) return pageNode;
  return <>{pageNode}{bottomNode}</>;
}
class BlockErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || error || '') };
  }

  componentDidCatch(error, info) {
    console.error('Block render error:', this.props.block?.type, this.props.block?.id, error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.block?.id !== this.props.block?.id || prevProps.block?.s !== this.props.block?.s) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      const meta = META[this.props.block?.type] || { label: '블록' };
      return (
        <section id={`block-${this.props.block?.id}`} className="landing-section block-render-fallback">
          <strong>{meta.label} 표시 오류</strong>
          <p>이 영역만 일시적으로 표시하지 못했습니다. 편집 옵션을 다시 선택하면 복구됩니다.</p>
        </section>
      );
    }
    return this.props.children;
  }
}

function RenderBlock(props) {
  const anchorId = props.block?.s?.anchorId;
  return (
    <>
      {anchorId && <span id={anchorId} className="landing-anchor" aria-hidden="true"></span>}
      <BlockErrorBoundary block={props.block}>
        <RenderBlockContent {...props}/>
      </BlockErrorBoundary>
    </>
  );
}

function RenderBlockContent({ page, block, blocks, leads = [], addLead, track, go }) {
  if(block.type==='topnav')return <LayoutRenderTopNav block={block} blocks={blocks} go={go}/>;
  if(block.type==='hero')return <ContentRenderHero block={block}/>;
  if(block.type==='image')return <MediaRenderImage block={block}/>;
  if(block.type==='text')return <ContentRenderText block={block}/>;
  if(block.type==='cards')return <ContentRenderCards block={block}/>;
  if(block.type==='map')return <InfoRenderMap block={block} page={page}/>;
  if(block.type==='schedule')return <InfoRenderSchedule block={block}/>;
  if(block.type==='faq')return <InfoRenderFaq block={block}/>;
  if(block.type==='links')return <LinkRenderLinks block={block} track={track} go={go}/>;
  if(block.type==='download')return <LinkRenderDownload block={block} track={track}/>;
  if(block.type==='timer')return <SignalRenderTimer block={block} go={go}/>;
  if(block.type==='activity')return <SignalRenderActivity block={block} leads={leads}/>;
  if(block.type==='spacer')return <LayoutRenderSpacer block={block}/>;
  if(block.type==='divider')return <LayoutRenderDivider block={block}/>;
  if(block.type==='code')return <UtilityRenderCode block={block}/>;
  if(block.type==='search')return <UtilityRenderPageSearch block={block}/>;
  if(block.type==='form')return <FormRenderForm block={block} addLead={addLead} track={track}/>;
  if(block.type==='reservation')return <FormRenderReservation block={block} addLead={addLead} track={track}/>;
  if(block.type==='footer')return <LayoutRenderFooter block={block}/>;
  return <section className="landing-section block-render-fallback"><strong>지원하지 않는 블록</strong></section>;
}
function safeCssId(value = '') {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : String(value).replace(/"/g, '\\"');
}
function getSyncedTimerSettings(blocks = []) {
  const timer = (blocks || []).find((b)=>b?.type === 'timer' && b?.visible !== false);
  return timer?.s || null;
}

function RenderBottom({ block, blocks = [], accent = '#111827', buttonEffect = 'fill', go, publicView = false }) {
  const s=block.s || {};
  const btns=normalizeButtons(s.buttons,s.count).slice(0,Number(s.count||1)).filter((b)=>b.enabled!==false);
  const timerSource = getSyncedTimerSettings(blocks);
  const showTimer = !!s.timerEnabled && !!timerSource;
  if(!btns.length && !showTimer) return null;
  const style = pickSafe(s.style, ['pill','box'], 'pill');
  const color = pickSafe(s.color, ['dark','accent','light'], 'dark');
  const barStyle = {
    '--accent': accent || '#111827',
    '--bottom-button': themeButtonColor(s),
    '--bottom-button-text': s.buttonTextColor || '#ffffff',
    '--button': themeButtonColor(s),
    '--button-text': s.buttonTextColor || '#ffffff',
    '--bottom-button-count': String(Math.max(1, btns.length || 1)),
  };

  return (
    <div className={`bottom-bar ${publicView ? 'public-bottom-bar' : ''} count-${btns.length || 1} bottom-${style} color-${color} bottom-custom-color button-effect-${buttonEffect}`} data-public-bottom={publicView ? 'true' : undefined} style={barStyle}>
      {showTimer && <RenderBottomTimer s={timerSource}/>}
      <div className="bottom-bar-buttons">
        {btns.map(b=>(
          <button key={b.id} type="button" className={b.icon ? '' : 'no-icon'} title={b.label || '버튼'} onClick={()=>go(b.target,b.url,b.label)}>
            {b.icon && <span>{b.icon}</span>}
            <b>{b.label}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

function RenderBottomTimer({ s }) {
  const t = useCountdown(s || {});
  const theme = pickSafe(s?.timerTheme || 'modern', ['modern','glass','minimal','accent'], 'modern');
  const urgency = getTimerUrgency(t.diffMs, t.done);
  const hasDays = Number(t.d) > 0;

  return (
    <div className={`bottom-timer bottom-timer-${theme} bottom-timer-urgency-${urgency} ${hasDays ? 'bottom-timer-has-days' : 'bottom-timer-no-days'} ${urgency !== 'normal' && urgency !== 'ended' ? 'bottom-timer-imminent' : ''}`}>
      <div className="bottom-timer-main">
        <span>{s?.floatLabel || s?.label || '마감까지'}</span>
        <strong>
          {hasDays ? <em>D-{t.d}</em> : null}
          <b>{t.h}:{t.m}:{t.s}</b>
        </strong>
      </div>
      <div className="bottom-timer-track"><i style={{width:`${t.progress}%`}}></i></div>
    </div>
  );
}

function getPageBg(theme) {
  if (theme?.bgMode === 'gradient') {
    const ratio = Math.max(0, Math.min(100, Number(theme.gradientRatio ?? 50)));
    const from = theme.gradientFrom || '#F5F7FA';
    const to = theme.gradientTo || '#EAF2FF';
    return `linear-gradient(135deg, ${from} 0%, ${from} ${ratio}%, ${to} 100%)`;
  }

  if (theme?.bgMode === 'image' && theme.bgImage) {
    if (theme.bgOverlay === false) return `url(${theme.bgImage})`;
    const rgb = hexToRgb(theme.bgOverlayColor || '#F5F7FA');
    const alpha = Math.max(0, Math.min(90, Number(theme.bgOverlayOpacity ?? 72))) / 100;
    return `linear-gradient(rgba(${rgb.r},${rgb.g},${rgb.b},${alpha}),rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})),url(${theme.bgImage})`;
  }

  return theme?.bgSolid || theme?.bg || '#F5F7FA';
}

function hexToRgb(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function normalizeButtons(buttons=[],count=1){
  const d=[
    {id:uid(),enabled:true,icon:'💬',label:'상담',target:'form',url:''},
    {id:uid(),enabled:true,icon:'📅',label:'예약',target:'reservation',url:''},
    {id:uid(),enabled:true,icon:'📞',label:'전화',target:'phone',url:'tel:01000000000'}
  ];
  return Array.from({length:Number(count)},(_,i)=>({
    ...(d[i]||{id:uid(),enabled:true,icon:'🔗',label:'버튼',target:'form',url:''}),
    ...(buttons[i]||{}),
    id:(buttons[i]?.id || d[i]?.id || uid()),
    enabled: buttons[i]?.enabled !== false,
    icon: Object.prototype.hasOwnProperty.call(buttons[i] || {}, 'icon') ? buttons[i].icon : (d[i]?.icon || '🔗'),
    label: buttons[i]?.label || d[i]?.label || '버튼',
    lastWidgetTarget: buttons[i]?.lastWidgetTarget || d[i]?.lastWidgetTarget || '',
  }));
}
export default LandingRenderer;



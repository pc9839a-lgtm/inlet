import { hexToRgb, pickSafe, rich, widgetBoxClass, widgetBoxVars } from './previewUtils.jsx';

function HeroContent({ s }) {
  const badges = Array.isArray(s.badges) ? s.badges.filter(Boolean).slice(0, 3) : [];
  const body = String(s.body || '').trim();
  return (
    <div>
      {s.kicker && <span className="hero-kicker">{rich(s.kicker)}</span>}
      <h1>{rich(s.title)}</h1>
      {body ? <p>{rich(body)}</p> : null}
      {!!badges.length && (
        <div className="hero-badges">
          {badges.map((badge) => <em key={badge}>{badge}</em>)}
        </div>
      )}
    </div>
  );
}

export function RenderHero({ block }) {
  const s = block.s || {};
  const imageMode = pickSafe(s.imageMode, ['top','background','full'], 'top');
  const imageFit = pickSafe(s.imageFit || 'contain', ['cover','contain'], 'contain');
  const align = pickSafe(s.align, ['left','center','right'], 'left');
  const titleSize = pickSafe(s.titleSize, ['small','medium','large'], 'large');
  const bodySize = pickSafe(s.bodySize, ['small','medium','large'], 'medium');
  const height = pickSafe(s.height, ['small','medium','large'], 'medium');
  const imageHeightPx = Math.max(180, Math.min(720, Number(s.imageHeightPx ?? 320)));
  const rgb = hexToRgb(s.overlayColor || '#000000');
  const alpha = s.overlay !== false ? Math.max(0, Math.min(0.85, Number(s.overlayOpacity ?? 38) / 100)) : 0;
  const overlay = `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  const showText = imageMode !== 'full' || s.fullText !== false;
  const imageVars = { '--hero-image-height': `${imageHeightPx}px` };
  const bleedClass = s.heroBleed === 'page' ? 'bleed-page' : 'bleed-content';

  if (imageMode === 'full') {
    return (
      <section
        id={`block-${block.id}`}
        className={`landing-section hero hero-full ${bleedClass} align-${align} title-${titleSize} body-${bodySize} height-${height} fit-${imageFit} ${s.bold ? 'is-bold' : ''} ${s.underline ? 'is-underline' : ''}`}
        style={imageVars}
      >
        {s.image ? (
          <div className="hero-full-media">
            <img src={s.image} alt="" draggable="false" />
            {showText && s.overlay !== false && <i style={{ background: overlay }} />}
            {showText && (
              <div className="hero-full-content">
                <HeroContent s={s} />
              </div>
            )}
          </div>
        ) : (
          <div className="hero-full-empty">
            <h1>{rich(s.title || '이미지를 업로드하세요')}</h1>
            <p>히어로 영역에 사용할 대표 이미지를 넣어주세요.</p>
          </div>
        )}
      </section>
    );
  }

  const bg = imageMode === 'background' && s.image
    ? { backgroundImage: `linear-gradient(${overlay},${overlay}),url(${s.image})` }
    : {};

  return (
    <section
      id={`block-${block.id}`}
      style={{ ...bg, ...imageVars }}
      className={`landing-section hero hero-${imageMode} align-${align} title-${titleSize} body-${bodySize} height-${height} fit-${imageFit} ${s.bold ? 'is-bold' : ''} ${s.underline ? 'is-underline' : ''}`}
    >
      {imageMode === 'top' && s.image && <img className="hero-img" src={s.image} alt="" />}
      <HeroContent s={s} />
    </section>
  );
}

export function RenderText({ block }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout, ['plain','card','notice'], 'plain');
  const align = pickSafe(s.align, ['left','center','right'], 'left');
  const size = pickSafe(s.size, ['small','medium','large'], 'medium');
  const title = String(s.title || '').trim();
  const body = String(s.body || '').trim();

  return (
    <section
      id={`block-${block.id}`}
      data-text-layout={layout}
      className={`landing-section text text-${layout} align-${align} text-size-${size} ${s.bold ? 'is-bold' : ''} ${s.underline ? 'is-underline' : ''} ${widgetBoxClass(s)}`}
      style={widgetBoxVars(s)}
    >
      {title ? <h2>{rich(title)}</h2> : null}
      {body ? <p>{rich(body)}</p> : null}
    </section>
  );
}

export function RenderCards({ block }) {
  const s = block.s || {};
  const layout = pickSafe(s.layout, ['grid','stack','steps'], 'grid');
  const tone = pickSafe(s.tone, ['soft','solid','outline'], 'soft');
  const align = pickSafe(s.align, ['left','center'], 'left');
  const items = Array.isArray(s.items) ? s.items.slice(0, 8) : [];
  const columns = Math.max(1, Math.min(2, Number(s.columns || 2)));
  return (
    <section id={`block-${block.id}`} className={`landing-section cards-widget cards-${layout} cards-${tone} cards-cols-${columns} align-${align} ${widgetBoxClass(s, { background: false, shadow: false })}`} style={{ '--cards-columns': columns, ...widgetBoxVars(s) }}>
      {s.title && <h2>{rich(s.title)}</h2>}
      {s.desc && <p className="cards-desc">{rich(s.desc)}</p>}
      <div className="cards-grid">
        {items.map((item, index) => (
          <article key={item.id || index} className="cards-item">
            {(item.eyebrow ?? String(index + 1).padStart(2, '0')) && <span>{item.eyebrow ?? String(index + 1).padStart(2, '0')}</span>}
            {item.title && <strong>{rich(item.title)}</strong>}
            {item.body && <p>{rich(item.body)}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

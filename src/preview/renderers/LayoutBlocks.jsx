function pickSafe(value, list, fallback) {
  return list.includes(value) ? value : fallback;
}

function normalizeHex(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw.slice(1).split('').map((char) => `${char}${char}`).join('')}`;
  }
  return '';
}

function isDarkHex(value = '') {
  const hex = normalizeHex(value);
  if (!hex) return false;
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return ((red * 299 + green * 587 + blue * 114) / 1000) < 128;
}

function topNavLogoTextColor(s = {}, logoStyle = 'plain', bg = 'white') {
  const logoColor = normalizeHex(s.logoColor || '#111827');
  const savedText = normalizeHex(s.logoTextColor || '');
  if (logoStyle === 'badge') {
    if (!savedText) return '#ffffff';
    if (savedText === logoColor) return isDarkHex(logoColor) ? '#ffffff' : '#111827';
    if (isDarkHex(logoColor) && savedText === '#111827') return '#ffffff';
    return s.logoTextColor;
  }
  return s.logoTextColor || (bg === 'dark' ? '#ffffff' : 'var(--text)');
}

export function RenderSpacer({ block }) {
  const height = Math.max(8, Math.min(200, Number(block.s?.height ?? 40)));
  return (
    <section
      id={`block-${block.id}`}
      className="landing-section spacer-sec"
      style={{ height: `${height}px` }}
      aria-label="여백"
    />
  );
}

export function RenderTopNav({ block, go }) {
  const s = block.s || {};
  const bg = pickSafe(s.bg, ['white','transparent','dark'], 'white');
  const isImageLogo = s.logoType === 'image' && !!s.logoImage;
  const logoStyle = isImageLogo ? 'image' : pickSafe(s.logoStyle || 'plain', ['plain','badge'], 'plain');
  const logoSize = pickSafe(s.logoSize || 'medium', ['small','medium','large'], 'medium');
  const menuStyle = pickSafe(s.menuStyle || 'pill', ['pill','text','outline'], 'pill');
  const menuSize = pickSafe(s.menuSize || 'medium', ['small','medium','large'], 'medium');
  const align = pickSafe(s.align || 'left', ['left','center','right'], 'left');
  const menus = Array.isArray(s.menus) ? s.menus.slice(0, 5) : [];
  const isPillMenu = menuStyle === 'pill';
  const menuBg = s.menuBgColor && s.menuBgColor !== '#F1F5F9' ? s.menuBgColor : (isPillMenu && bg === 'dark' ? '#ffffff' : 'var(--card)');
  const logoText = topNavLogoTextColor(s, logoStyle, bg);
  const menuText = s.menuTextColor || (isPillMenu ? '#111827' : (bg === 'dark' ? '#ffffff' : 'var(--text)'));
  const savedMenuHover = s.menuHoverColor && !['#ffffff', '#fff', '#F1F5F9'].includes(s.menuHoverColor) ? s.menuHoverColor : '';
  const menuHover = savedMenuHover || (isPillMenu ? 'var(--accent)' : (bg === 'dark' ? 'rgba(255,255,255,.14)' : 'rgba(17,24,39,.08)'));
  const menuHoverText = s.menuHoverTextColor || (isPillMenu ? '#ffffff' : (bg === 'dark' ? '#ffffff' : 'var(--text)'));
  const barBg = s.barBgColor || (bg === 'dark' ? '#111827' : bg === 'transparent' ? 'rgba(255,255,255,.72)' : '#ffffff');
  const vars = {
    '--top-bar-bg': barBg,
    '--top-logo-color': s.logoColor || '#111827',
    '--top-logo-text': logoText,
    '--top-menu-bg': menuBg,
    '--top-menu-text': menuText,
    '--top-menu-hover': menuHover,
    '--top-menu-hover-text': menuHoverText,
  };
  const renderMenuButton = (m, duplicate = false) => (
    <button
      type="button"
      key={`${duplicate ? 'copy-' : ''}${m.id}`}
      tabIndex={duplicate ? -1 : undefined}
      aria-hidden={duplicate ? 'true' : undefined}
      onClick={duplicate ? undefined : () => go(m.target, m.url, m.label)}
    >
      {m.label}
    </button>
  );

  return (
    <section id={`block-${block.id}`} className={`landing-section topnav topnav-one-line topnav-${bg} topnav-align-${align} topnav-logo-${logoStyle} logo-${logoSize} menu-${menuStyle} menu-${menuSize} ${s.sticky ? 'topnav-sticky' : ''}`} style={vars}>
      <div className="top-logo">{isImageLogo ? <img src={s.logoImage} alt="" /> : <strong>{s.logoText || 'LOGO'}</strong>}</div>
      <div className="top-menu">
        <div className="top-menu-track">
          <div className="top-menu-set">{menus.map((m) => renderMenuButton(m))}</div>
        </div>
      </div>
    </section>
  );
}

export function RenderDivider({ block }) {
  const s = block.s || {};
  const style = pickSafe(s.style || 'solid', ['solid','dashed','dotted'], 'solid');
  const align = pickSafe(s.align || 'center', ['left','center','right'], 'center');
  const lineStyle = {
    width: `${Math.max(10, Math.min(100, Number(s.width ?? 100)))}%`,
    borderTopWidth: `${Math.max(1, Math.min(8, Number(s.thickness ?? 1)))}px`,
    borderTopStyle: style,
    borderTopColor: s.color || '#E2E8F0',
  };
  const wrapStyle = {
    marginTop: `${Math.max(0, Math.min(80, Number(s.marginY ?? 24)))}px`,
    marginBottom: `${Math.max(0, Math.min(80, Number(s.marginY ?? 24)))}px`,
  };

  return (
    <section id={`block-${block.id}`} className={`landing-section divider-sec divider-align-${align}`} style={wrapStyle}>
      <div style={lineStyle} />
    </section>
  );
}

export function RenderFooter({ block }) {
  const s = block.s || {};
  const bg = pickSafe(s.bg, ['plain','soft','dark'], 'plain');
  const align = pickSafe(s.align, ['left','center','right'], 'center');

  return (
    <footer id={`block-${block.id}`} className={`landing-footer footer-${bg} align-${align}`}>
      <strong>{s.company}</strong>
      {s.owner && <p>대표 {s.owner}</p>}
      {s.phone && <p>{s.phone}</p>}
      {s.email && <p>{s.email}</p>}
      {s.address && <p>{s.address}</p>}
      {s.biz && <p>{s.biz}</p>}
      <div>
        {s.privacyUrl && <button type="button">개인정보처리방침</button>}
        {s.termsUrl && <button type="button">이용약관</button>}
      </div>
    </footer>
  );
}

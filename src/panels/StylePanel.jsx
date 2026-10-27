import { ChevronDown } from 'lucide-react';
import { ImageInput, Color } from '../editor/controls.jsx';
import { NumberControl } from '../editor/ui/NumberControl.jsx';
import { notify } from '../lib/uiFeedback.js';
import './StylePanel.css';

const T = {
  left: '\uC67C\uCABD',
  center: '\uAC00\uC6B4\uB370',
  right: '\uC624\uB978\uCABD',
  commonStyle: '전체 디자인',
  dirty: '스타일 미적용',
  clean: '스타일 적용됨',
  reset: '\uB418\uB3CC\uB9AC\uAE30',
  apply: '\uC801\uC6A9',
  bg: '\uBC30\uACBD',
  color: '\uC0C9\uC0C1',
  text: '\uAE00\uC790',
  type: '\uC885\uB958',
  effect: '\uD6A8\uACFC',
  opacity: '\uD22C\uBA85\uB3C4',
  solid: '\uB2E8\uC0C9',
  gradient: '\uADF8\uB77C\uB370\uC774\uC158',
  image: '\uC774\uBBF8\uC9C0',
  none: '\uC5C6\uC74C',
  snow: '\uB208',
  petals: '\uAF43\uC78E',
  sparkle: '\uBC18\uC9DD\uC784',
  bgColor: '\uBC30\uACBD\uC0C9',
  preset: '\uD504\uB9AC\uC14B',
  startColor: '\uC2DC\uC791\uC0C9',
  endColor: '\uB05D\uC0C9',
  ratio: '\uBE44\uC728',
  bgImage: '\uBC30\uACBD \uC774\uBBF8\uC9C0',
  fill: '\uCC44\uC6B0\uAE30',
  contain: '\uC804\uCCB4 \uBCF4\uAE30',
  original: '\uC6D0\uBCF8',
  position: '\uC704\uCE58',
  top: '\uC704',
  bottom: '\uC544\uB798',
  overlay: '\uB36E\uAC1C',
  buttonColor: '\uBC84\uD2BC\uC0C9',
  textColor: '\uAE00\uC790\uC0C9',
  align: '\uC815\uB82C',
  mood: '\uBD84\uC704\uAE30',
  font: '\uAE00\uAF34',
  modern: '\uBAA8\uB358',
  soft: '\uBD80\uB4DC\uB7FD\uAC8C',
  bold: '\uAC15\uD558\uAC8C',
  noChanges: '\uC801\uC6A9\uD560 \uBCC0\uACBD \uC0AC\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
  applied: '스타일을 편집본에 적용했습니다. 공개하려면 발행하세요.',
  noEyedropper: '\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uC2A4\uD3EC\uC774\uB4DC \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.',
  pickColor: '\uC0C9\uC0C1 \uCD94\uCD9C',
};

const ALIGN_OPTIONS = [
  ['left', T.left],
  ['center', T.center],
  ['right', T.right],
];

const BG_PRESETS = ['#F5F7FA', '#FFFFFF', '#EEF2FF', '#F8F3EA', '#111827'];

function safeColor(value, fallback = '#111827') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function StyleSegment({ label, value, onChange, options = [] }) {
  if (!options.length) return null;

  return (
    <div className="style-line style-segment-line">
      <span>{label}</span>
      <div className={`style-segment style-segment-count-${options.length}`} data-count={options.length}>
        {options.map(([key, text]) => (
          <button key={key} type="button" className={String(value) === String(key) ? 'active' : ''} aria-pressed={String(value) === String(key)} aria-label={`${label}: ${text}`} onClick={() => onChange(key)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function StyleColorLine({ label, value, onChange, fallback = '#111827' }) {
  return <div className="style-color-line"><Color label={label} value={safeColor(value, fallback)} onChange={onChange} /></div>;
}

function StyleRangeLine({ label, value, min = 0, max = 100, onChange, suffix = '' }) {
  return <NumberControl label={label} value={value ?? 0} min={min} max={max} unit={suffix} onChange={onChange} />;
}

function hexToRgb(hex) {
  const raw = String(hex || '#F5F7FA').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 245, g: 247, b: 250 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function cssUrl(value) {
  return `url(${JSON.stringify(String(value || ''))})`;
}

function getPageBg(theme = {}) {
  if (theme.bgMode === 'gradient') {
    const ratio = Math.max(0, Math.min(100, Number(theme.gradientRatio ?? 50)));
    const from = theme.gradientFrom || '#F5F7FA';
    const to = theme.gradientTo || '#EAF2FF';
    return `linear-gradient(135deg, ${from} 0%, ${from} ${ratio}%, ${to} 100%)`;
  }
  if (theme.bgMode === 'image' && theme.bgImage) {
    if (theme.bgOverlay === false) return cssUrl(theme.bgImage);
    const rgb = hexToRgb(theme.bgOverlayColor || '#F5F7FA');
    const alpha = Math.max(0, Math.min(90, Number(theme.bgOverlayOpacity ?? 72))) / 100;
    return `linear-gradient(rgba(${rgb.r},${rgb.g},${rgb.b},${alpha}),rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})),${cssUrl(theme.bgImage)}`;
  }
  return theme.bgSolid || theme.bg || '#F5F7FA';
}

export default function StylePanel({ page, updateTheme, stagedTheme = null, onPreviewThemeChange }) {
  // Unapplied values belong to the editor and survive panel unmounting.
  const draftTheme = stagedTheme ?? page.theme ?? {};
  const bgMode = draftTheme.bgMode || 'solid';
  const dirty = JSON.stringify(draftTheme) !== JSON.stringify(page.theme || {});

  const updateDraft = (patch) => onPreviewThemeChange?.({ ...draftTheme, ...patch });
  const applyStyle = () => {
    if (!dirty) {
      notify(T.noChanges);
      return;
    }
    updateTheme(draftTheme);
    onPreviewThemeChange?.(null);
    notify(T.applied, 'success');
  };
  const resetDraft = () => onPreviewThemeChange?.(null);

  return (
    <div className="simple-panel style-panel style-panel-v17 style-panel-staged style-direct-flow">
      <div className="style-apply-bar">
        <div>
          <strong>{T.commonStyle}</strong>
          <span>{dirty ? T.dirty : T.clean}</span>
        </div>
        <div>
          <button type="button" className="style-reset-btn" disabled={!dirty} onClick={resetDraft}>{T.reset}</button>
          <button type="button" className="style-apply-btn" disabled={!dirty} onClick={applyStyle}>{T.apply}</button>
        </div>
      </div>

      <section className="style-primary-group" aria-label="기본 디자인">
        <div className="style-panel-box style-primary-colors">
          <StyleColorLine label={T.buttonColor} value={draftTheme.accent} fallback="#2563EB" onChange={(next) => updateDraft({ accent: next })} />
          <StyleColorLine label={T.textColor} value={draftTheme.text} fallback="#111827" onChange={(next) => updateDraft({ text: next })} />
          <StyleSegment label={T.font} value={draftTheme.fontFamily || 'pretendard'} onChange={(next) => updateDraft({ fontFamily: next })} options={[[ 'pretendard', 'Pretendard' ], [ 'noto', 'Noto' ], [ 'serif', 'Serif' ]]} />
        </div>
      </section>

      <section className="style-primary-group style-background-group" aria-label="페이지 배경">
        <h3>{T.bg}</h3>
        <StyleSegment label={T.type} value={bgMode} onChange={(next) => updateDraft({ bgMode: next, bgOverlay: next === 'image' ? (draftTheme.bgOverlay ?? true) : draftTheme.bgOverlay })} options={[[ 'solid', T.solid ], [ 'gradient', T.gradient ], [ 'image', T.image ]]} />

        {bgMode === 'solid' && (
          <div className="style-panel-box">
            <StyleColorLine label={T.bgColor} value={draftTheme.bgSolid || draftTheme.bg} fallback="#F5F7FA" onChange={(next) => updateDraft({ bgSolid: next, bg: next, bgPreset: 'custom' })} />
            <div className="style-line style-preset-line">
              <span>{T.preset}</span>
              <div className="style-preset-row-v16">
                {BG_PRESETS.map((color) => (
                  <button key={color} type="button" className={(draftTheme.bg || draftTheme.bgSolid) === color ? 'active' : ''} aria-label={`${T.preset} ${color}`} aria-pressed={(draftTheme.bg || draftTheme.bgSolid) === color} style={{ background: color }} onClick={() => updateDraft({ bg: color, bgSolid: color, bgPreset: color })} title={color} />
                ))}
              </div>
            </div>
          </div>
        )}

        {bgMode === 'gradient' && (
          <div className="style-panel-box">
            <StyleColorLine label={T.startColor} value={draftTheme.gradientFrom || '#F5F7FA'} fallback="#F5F7FA" onChange={(next) => updateDraft({ gradientFrom: next })} />
            <StyleColorLine label={T.endColor} value={draftTheme.gradientTo || '#EAF2FF'} fallback="#EAF2FF" onChange={(next) => updateDraft({ gradientTo: next })} />
            <StyleRangeLine label={T.ratio} value={draftTheme.gradientRatio ?? 50} min={0} max={100} suffix="%" onChange={(next) => updateDraft({ gradientRatio: next })} />
          </div>
        )}

        {bgMode === 'image' && (
          <div className="style-panel-box style-photo-box">
            <div className="style-photo-upload"><ImageInput label={T.bgImage} value={draftTheme.bgImage} onChange={(next) => updateDraft({ bgImage: next, bgOverlay: draftTheme.bgOverlay ?? true })} /></div>
            <details className="style-advanced-group style-image-options">
              <summary><strong>사진 표시 옵션</strong><ChevronDown size={16} aria-hidden="true" /></summary>
              <div className="style-advanced-body">
                <StyleSegment label={T.ratio} value={draftTheme.bgImageFit || 'cover'} onChange={(next) => updateDraft({ bgImageFit: next })} options={[[ 'cover', T.fill ], [ 'contain', T.contain ], [ 'auto', T.original ]]} />
                <StyleSegment label={T.position} value={draftTheme.bgImagePosition || 'center'} onChange={(next) => updateDraft({ bgImagePosition: next })} options={[[ 'center', T.center ], [ 'top', T.top ], [ 'bottom', T.bottom ]]} />
                <div className="style-overlay-card-v16">
                  <div className="style-overlay-title">
                    <strong>{T.overlay}</strong>
                    <button type="button" className={draftTheme.bgOverlay !== false ? 'active' : ''} aria-label={T.overlay} aria-pressed={draftTheme.bgOverlay !== false} onClick={() => updateDraft({ bgOverlay: !(draftTheme.bgOverlay !== false) })}>{draftTheme.bgOverlay !== false ? 'ON' : 'OFF'}</button>
                  </div>
                  {draftTheme.bgOverlay !== false && (
                    <>
                      <StyleColorLine label={T.color} value={draftTheme.bgOverlayColor || '#F5F7FA'} fallback="#F5F7FA" onChange={(next) => updateDraft({ bgOverlayColor: next })} />
                      <StyleRangeLine label={T.opacity} value={draftTheme.bgOverlayOpacity ?? 72} min={0} max={90} suffix="%" onChange={(next) => updateDraft({ bgOverlayOpacity: next })} />
                    </>
                  )}
                </div>
                <div className="style-bg-preview-v16" role="img" aria-label="배경 이미지 미리보기" style={{ background: getPageBg(draftTheme), backgroundSize: draftTheme.bgImageFit === 'contain' ? 'contain' : draftTheme.bgImageFit === 'auto' ? 'auto' : 'cover', backgroundPosition: draftTheme.bgImagePosition || 'center' }} />
              </div>
            </details>
          </div>
        )}
      </section>

      <div className="style-more-groups">
        <details className="style-advanced-group">
          <summary><strong>글자 정렬·분위기</strong><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="style-advanced-body">
            <StyleSegment label={T.align} value={draftTheme.globalAlign || 'left'} onChange={(next) => updateDraft({ globalAlign: next })} options={ALIGN_OPTIONS} />
            <StyleSegment label={T.mood} value={draftTheme.font || 'modern'} onChange={(next) => updateDraft({ font: next })} options={[[ 'modern', T.modern ], [ 'soft', T.soft ], [ 'bold', T.bold ]]} />
          </div>
        </details>
        <details className="style-advanced-group">
          <summary><strong>배경 효과</strong><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="style-advanced-body">
            <StyleSegment label={T.effect} value={draftTheme.bgEffect || 'none'} onChange={(next) => updateDraft({ bgEffect: next })} options={[[ 'none', T.none ], [ 'snow', T.snow ], [ 'petals', T.petals ], [ 'sparkle', T.sparkle ]]} />
            {(draftTheme.bgEffect || 'none') !== 'none' && <StyleRangeLine label={T.opacity} value={draftTheme.bgEffectOpacity ?? 45} min={10} max={90} suffix="%" onChange={(next) => updateDraft({ bgEffectOpacity: next })} />}
          </div>
        </details>
      </div>
    </div>
  );
}

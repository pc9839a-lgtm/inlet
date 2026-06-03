import { useEffect, useMemo, useState } from 'react';
import { Pipette } from 'lucide-react';
import { ImageInput } from '../editor/controls.jsx';
import { confirmAction, notify } from '../lib/uiFeedback.js';
import './StylePanel.css';

const BLOCK_LABELS = {
  topnav: '상단 메뉴',
  hero: '히어로',
  image: '이미지',
  text: '텍스트',
  cards: '카드',
  links: '링크',
  download: '다운로드',
  map: '지도',
  schedule: '일정',
  faq: 'FAQ',
  timer: '타이머',
  activity: '접수 현황',
  spacer: '여백',
  divider: '구분선',
  code: '코드',
  search: '검색',
  form: '상담폼',
  reservation: '예약폼',
  bottombar: '하단 버튼',
  footer: '푸터',
};

const STYLE_WIDGET_TYPES = new Set([
  'topnav',
  'hero',
  'text',
  'cards',
  'links',
  'download',
  'schedule',
  'faq',
  'timer',
  'activity',
  'form',
  'reservation',
  'bottombar',
  'spacer',
  'divider',
  'code',
  'search',
]);

const ALIGN_WIDGET_TYPES = new Set(['hero', 'text', 'cards', 'links', 'download', 'schedule', 'timer', 'search']);

const WIDGET_STYLE_CONFIG = {
  topnav: {
    variant: { key: 'bg', value: 'white', options: [['white', '밝게'], ['dark', '어둡게'], ['transparent', '투명']] },
    logo: { key: 'logoStyle', value: 'plain', options: [['plain', '글자'], ['badge', '배지']] },
    logoSize: { key: 'logoSize', value: 'medium', options: [['small', '작게'], ['medium', '기본'], ['large', '크게']] },
    button: { key: 'menuStyle', value: 'pill', options: [['pill', '버튼'], ['text', '글자'], ['outline', '테두리']] },
    menuSize: { key: 'menuSize', value: 'medium', options: [['small', '작게'], ['medium', '기본'], ['large', '크게']] },
  },
  hero: {
    imageMode: { key: 'imageMode', value: 'top', options: [['top', '일반'], ['full', '전체']] },
    imageBleed: { key: 'heroBleed', value: 'content', options: [['content', '기본'], ['page', '배경까지']] },
    height: { key: 'imageHeightPx', value: 320, min: 180, max: 720, suffix: 'px' },
    overlay: { key: 'overlayOpacity', value: 38, min: 0, max: 85, suffix: '%' },
    align: true,
  },
  text: {
    variant: { key: 'layout', value: 'plain', options: [['plain', '기본'], ['card', '카드'], ['notice', '알림']] },
    align: true,
    size: true,
  },
  cards: {
    variant: { key: 'layout', value: 'grid', options: [['grid', '그리드'], ['stack', '목록'], ['steps', '단계']] },
    tone: { key: 'tone', value: 'soft', options: [['soft', '부드럽게'], ['solid', '강조'], ['outline', '라인']] },
    align: { options: [['left', '왼쪽'], ['center', '중앙']] },
    columns: { key: 'columns', value: 2, options: [['1', '1열'], ['2', '2열']] },
  },
  links: {
    variant: { key: 'layout', value: 'list', options: [['list', '리스트'], ['card', '카드'], ['carousel', '캐러셀']] },
    align: true,
  },
  download: {
    variant: { key: 'layout', value: 'card', options: [['card', '카드'], ['list', '목록']] },
    align: true,
  },
  schedule: {
    align: { value: 'center' },
  },
  faq: {
    variant: { key: 'layout', value: 'accordion', options: [['accordion', '아코디언'], ['card', '카드'], ['plain', '기본']] },
  },
  timer: {
    variant: { key: 'timerTheme', value: 'modern', options: [['modern', '모던'], ['glass', '글래스'], ['minimal', '미니멀'], ['accent', '임박']] },
    effect: { key: 'urgentStyle', value: 'flip', options: [['flip', '숫자'], ['line', '게이지'], ['flow', '흐름'], ['none', '없음']] },
    align: true,
  },
  activity: {
    variant: { key: 'style', value: 'glass', options: [['minimal', '미니멀'], ['glass', '글래스'], ['dark', '다크']] },
    effect: { key: 'animation', value: 'stack', options: [['stack', '쌓임'], ['none', '없음']] },
  },
  form: {
    variant: { key: 'style', value: 'card', options: [['card', '카드'], ['line', '라인'], ['soft', '소프트'], ['minimal', '미니멀']] },
    input: { key: 'inputStyle', value: 'round', options: [['round', '둥글게'], ['box', '박스'], ['underline', '밑줄']] },
    button: { key: 'buttonStyle', value: 'solid', options: [['solid', '채움'], ['round', '둥근'], ['line', '라인']] },
    effect: { key: 'buttonHover', value: 'fill', options: [['fill', '채움'], ['slide', '슬라이드'], ['zoom', '확대']] },
    align: { key: 'textAlign', value: 'left', options: [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] },
    spacing: { key: 'spacing', value: 'normal', options: [['compact', '좁게'], ['normal', '기본'], ['wide', '넓게']] },
    radius: { key: 'radiusStyle', value: 'round', options: [['square', '각지게'], ['round', '둥글게'], ['pill', '알약형']] },
  },
  reservation: {
    variant: { key: 'style', value: 'card', options: [['card', '카드'], ['line', '라인'], ['soft', '소프트'], ['minimal', '미니멀']] },
    input: { key: 'inputStyle', value: 'round', options: [['round', '둥글게'], ['box', '박스'], ['underline', '밑줄']] },
    button: { key: 'buttonStyle', value: 'solid', options: [['solid', '채움'], ['round', '둥근'], ['line', '라인']] },
    effect: { key: 'buttonHover', value: 'fill', options: [['fill', '채움'], ['slide', '슬라이드'], ['zoom', '확대']] },
    align: { key: 'textAlign', value: 'left', options: [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']] },
    spacing: { key: 'spacing', value: 'normal', options: [['compact', '좁게'], ['normal', '기본'], ['wide', '넓게']] },
    radius: { key: 'radiusStyle', value: 'round', options: [['square', '각지게'], ['round', '둥글게'], ['pill', '알약형']] },
  },
  bottombar: {
    variant: { key: 'style', value: 'pill', options: [['pill', '둥근'], ['box', '박스']] },
    tone: { key: 'color', value: 'dark', options: [['dark', '어둡게'], ['accent', '강조'], ['light', '밝게']] },
  },
  spacer: {
    height: { key: 'height', value: 40, min: 8, max: 200, suffix: 'px' },
  },
  divider: {
    width: { key: 'width', value: 100, min: 10, max: 100, suffix: '%' },
    thickness: { key: 'thickness', value: 1, min: 1, max: 8, suffix: 'px' },
  },
  code: {},
  search: {
    variant: { key: 'layout', value: 'card', options: [['card', '카드'], ['bar', '바'], ['minimal', '미니멀']] },
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function blockLabel(block, index) {
  const base = BLOCK_LABELS[block?.type] || block?.type || '위젯';
  const title = block?.s?.title || block?.s?.label || block?.s?.logoText || '';
  return `${index + 1}. ${base}${title ? ` · ${String(title).replace(/<[^>]+>/g, '').slice(0, 18)}` : ''}`;
}

function StyleSegment({ label, value, onChange, options }) {
  return (
    <div className="style-line style-segment-line">
      <span>{label}</span>
      <div className="style-segment">
        {options.map(([key, text]) => (
          <button key={key} type="button" className={String(value) === String(key) ? 'active' : ''} onClick={() => onChange(key)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function StyleColorLine({ label, value, onChange }) {
  const color = value || '#111827';

  const pick = async () => {
    if (!window.EyeDropper) {
      notify('Chrome/Edge 최신 버전에서 스포이드 기능을 사용할 수 있습니다.', 'error');
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch {}
  };

  return (
    <div className="style-line style-color-line">
      <span>{label}</span>
      <div className="style-color-control">
        <input type="color" value={color} onChange={(event) => onChange(event.target.value)} />
        <b>{color}</b>
        <button type="button" onClick={pick} title="색상 추출" aria-label={`${label} 색상 추출`}><Pipette size={16} /></button>
      </div>
    </div>
  );
}

function StyleRangeLine({ label, value, min = 0, max = 100, onChange, suffix = '' }) {
  return (
    <div className="style-line style-range-line">
      <span>{label}</span>
      <div className="style-range-control">
        <input type="range" min={min} max={max} value={value ?? 0} onChange={(event) => onChange(event.target.value)} />
        <b>{value ?? 0}{suffix}</b>
      </div>
    </div>
  );
}

function normalizeButtonEffect(value) {
  return ({ lift: 'fill', glow: 'shine', press: 'burst' }[value] || value || 'fill');
}

function hexToRgb(hex) {
  const raw = String(hex || '#F5F7FA').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 245, g: 247, b: 250 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function getPageBg(theme = {}) {
  if (theme.bgMode === 'gradient') {
    const ratio = Math.max(0, Math.min(100, Number(theme.gradientRatio ?? 50)));
    const from = theme.gradientFrom || '#F5F7FA';
    const to = theme.gradientTo || '#EAF2FF';
    return `linear-gradient(135deg, ${from} 0%, ${from} ${ratio}%, ${to} 100%)`;
  }

  if (theme.bgMode === 'image' && theme.bgImage) {
    if (theme.bgOverlay === false) return `url(${theme.bgImage})`;
    const rgb = hexToRgb(theme.bgOverlayColor || '#F5F7FA');
    const alpha = Math.max(0, Math.min(90, Number(theme.bgOverlayOpacity ?? 72))) / 100;
    return `linear-gradient(rgba(${rgb.r},${rgb.g},${rgb.b},${alpha}),rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})),url(${theme.bgImage})`;
  }

  return theme.bgSolid || theme.bg || '#F5F7FA';
}

function UnifiedSegment({ label, config, s, update }) {
  if (!config) return null;
  const value = String(s[config.key] ?? config.value ?? config.options?.[0]?.[0] ?? '');
  return <StyleSegment label={label} value={value} onChange={(next) => update({ [config.key]: config.key === 'columns' ? Number(next) : next })} options={config.options} />;
}

function UnifiedAlign({ config, s, update }) {
  if (!config) return null;
  const normalized = config === true ? {} : config;
  const options = normalized.options || [['left', '왼쪽'], ['center', '중앙'], ['right', '오른쪽']];
  const key = normalized.key || 'align';
  return <StyleSegment label="정렬" value={s[key] || normalized.value || 'left'} onChange={(next) => update({ [key]: next })} options={options} />;
}

function UnifiedSize({ config, s, update }) {
  if (!config) return null;
  return <StyleSegment label="크기" value={s.size || 'medium'} onChange={(next) => update({ size: next })} options={[['small', 'S'], ['medium', 'M'], ['large', 'L']]} />;
}

function UnifiedRange({ label, config, s, update }) {
  if (!config) return null;
  return <StyleRangeLine label={label} value={s[config.key] ?? config.value} min={config.min} max={config.max} suffix={config.suffix || ''} onChange={(next) => update({ [config.key]: Number(next) })} />;
}

function WidgetStyleControls({ block, update }) {
  if (!block) return <div className="style-widget-empty">스타일을 수정할 위젯을 선택하세요.</div>;
  const s = block.s || {};
  const config = WIDGET_STYLE_CONFIG[block.type] || {};
  const imageMode = s.imageMode === 'full' ? 'full' : (config.imageMode?.value || 'top');

  return (
    <div className="style-unified-editor">
      <UnifiedSegment label="형태" config={config.variant} s={s} update={update} />
      <UnifiedAlign config={config.align} s={s} update={update} />
      <UnifiedSize config={config.size} s={s} update={update} />
      <UnifiedSegment label="톤" config={config.tone} s={s} update={update} />
      <UnifiedSegment label="열" config={config.columns} s={s} update={update} />
      <UnifiedSegment label="로고" config={config.logo} s={s} update={update} />
      <UnifiedSegment label="로고 크기" config={config.logoSize} s={s} update={update} />
      <UnifiedSegment label="입력칸" config={config.input} s={s} update={update} />
      <UnifiedSegment label="버튼" config={config.button} s={s} update={update} />
      <UnifiedSegment label="메뉴 크기" config={config.menuSize} s={s} update={update} />
      <UnifiedSegment label="효과" config={config.effect} s={s} update={update} />
      <UnifiedSegment label="간격" config={config.spacing} s={s} update={update} />
      <UnifiedSegment label="모서리" config={config.radius} s={s} update={update} />
      {config.imageMode ? (
        <StyleSegment label="이미지" value={imageMode} onChange={(next) => update({ imageMode: next, imageFit: next === 'full' ? 'cover' : 'contain' })} options={config.imageMode.options} />
      ) : null}
      {config.imageBleed && imageMode === 'full' && (
        <UnifiedSegment label="확장" config={config.imageBleed} s={s} update={(patch) => update({ ...patch, imageFit: 'cover' })} />
      )}
      <UnifiedRange label="높이" config={config.height} s={s} update={update} />
      <UnifiedRange label="너비" config={block.type === 'divider' ? config.width : null} s={s} update={update} />
      {config.overlay && imageMode === 'full' && (
        <UnifiedRange label="오버레이" config={config.overlay} s={s} update={(patch) => update({ overlay: true, ...patch })} />
      )}
    </div>
  );
}

export default function StylePanel({ page, updateTheme, updateBlocks, onPreviewThemeChange, onPreviewBlocksChange }) {
  const [section, setSection] = useState('background');
  const [draftTheme, setDraftTheme] = useState(page.theme || {});
  const [draftBlocks, setDraftBlocks] = useState(() => clone(page.blocks || []));
  const styleBlocks = useMemo(() => draftBlocks.filter((block) => STYLE_WIDGET_TYPES.has(block.type)), [draftBlocks]);
  const defaultStyleBlockId = useMemo(() => (
    styleBlocks.find((block) => !['topnav', 'bottombar', 'footer'].includes(block.type))?.id
    || styleBlocks[0]?.id
    || ''
  ), [styleBlocks]);
  const [selectedBlockId, setSelectedBlockId] = useState(() => defaultStyleBlockId);
  const selectedBlock = styleBlocks.find((block) => block.id === selectedBlockId) || styleBlocks.find((block) => block.id === defaultStyleBlockId) || null;
  const bgPresets = ['#F5F7FA', '#FFFFFF', '#EEF2FF', '#F8F3EA', '#111827'];
  const bgMode = draftTheme.bgMode || 'solid';
  const dirty = useMemo(
    () => JSON.stringify(draftTheme) !== JSON.stringify(page.theme || {}) || JSON.stringify(draftBlocks) !== JSON.stringify(page.blocks || []),
    [draftTheme, draftBlocks, page.theme, page.blocks],
  );

  useEffect(() => {
    setDraftTheme(page.theme || {});
    setDraftBlocks(clone(page.blocks || []));
  }, [page.theme, page.blocks]);

  useEffect(() => {
    if (!selectedBlock && defaultStyleBlockId) setSelectedBlockId(defaultStyleBlockId);
  }, [defaultStyleBlockId, selectedBlock]);

  useEffect(() => {
    onPreviewThemeChange?.(draftTheme);
  }, [draftTheme, onPreviewThemeChange]);

  useEffect(() => {
    onPreviewBlocksChange?.(draftBlocks);
  }, [draftBlocks, onPreviewBlocksChange]);

  useEffect(() => {
    return () => {
      onPreviewThemeChange?.(null);
      onPreviewBlocksChange?.(null);
    };
  }, [onPreviewThemeChange, onPreviewBlocksChange]);

  const updateDraft = (patch) => {
    setDraftTheme((theme) => ({ ...theme, ...patch }));
  };

  const updateSelectedWidget = (patch) => {
    if (!selectedBlock) return;
    setDraftBlocks((blocks) => blocks.map((block) => (
      block.id === selectedBlock.id
        ? { ...block, s: { ...(block.s || {}), ...patch } }
        : block
    )));
  };

  const updateAllAlign = (align) => {
    updateDraft({ globalAlign: align });
    setDraftBlocks((blocks) => blocks.map((block) => (
      ALIGN_WIDGET_TYPES.has(block.type)
        ? { ...block, s: { ...(block.s || {}), align } }
        : block
    )));
  };

  const applyStyle = async () => {
    if (!dirty) {
      notify('변경된 스타일 설정이 없습니다.');
      return;
    }

    const ok = await confirmAction({
      title: '스타일 설정을 적용할까요?',
      message: '공통 스타일과 위젯별 스타일이 현재 설정값으로 변경됩니다. 저장 버튼을 눌러야 서버 저장까지 완료됩니다.',
      confirmLabel: '적용',
    });
    if (!ok) return;
    updateTheme(draftTheme);
    updateBlocks?.(draftBlocks);
    onPreviewThemeChange?.(null);
    onPreviewBlocksChange?.(null);
    notify('스타일 설정이 적용되었습니다.', 'success');
  };

  const resetDraft = () => {
    setDraftTheme(page.theme || {});
    setDraftBlocks(clone(page.blocks || []));
  };

  return (
    <div className="simple-panel style-panel style-panel-v17 style-panel-staged">
      <div className="style-apply-bar">
        <div>
          <strong>스타일 설정</strong>
          <span>{dirty ? '변경사항이 있습니다. 적용 또는 저장을 눌러야 저장됩니다.' : '현재 적용된 스타일입니다.'}</span>
        </div>
        <div>
          <button type="button" className="style-reset-btn" disabled={!dirty} onClick={resetDraft}>되돌리기</button>
          <button type="button" className="style-apply-btn" disabled={!dirty} onClick={applyStyle}>적용</button>
        </div>
      </div>

      <div className="style-common-title">
        <strong>공통 스타일</strong>
        <span>전체 페이지 기본 디자인입니다. 아래 위젯 스타일에서 필요한 위젯만 세부 조정합니다.</span>
      </div>

      <div className="style-subnav">
        {[
          ['background', '배경'],
          ['color', '색상'],
          ['text', '텍스트'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={section === key ? 'active' : ''} onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </div>

      {section === 'background' && (
        <section className="card style-card style-bg-card">
          <div className="section-title"><h2>배경</h2></div>

          <StyleSegment
            label="종류"
            value={bgMode}
            onChange={(next) => updateDraft({ bgMode: next, bgOverlay: next === 'image' ? (draftTheme.bgOverlay ?? true) : draftTheme.bgOverlay })}
            options={[['solid', '단색'], ['gradient', '그라데이션'], ['image', '사진']]}
          />
          <StyleSegment
            label="배경 효과"
            value={draftTheme.bgEffect || 'none'}
            onChange={(next) => updateDraft({ bgEffect: next })}
            options={[['none', '없음'], ['snow', '눈'], ['petals', '꽃잎'], ['sparkle', '반짝임']]}
          />
          {(draftTheme.bgEffect || 'none') !== 'none' && (
            <StyleRangeLine label="효과 농도" value={draftTheme.bgEffectOpacity ?? 45} min={10} max={90} suffix="%" onChange={(next) => updateDraft({ bgEffectOpacity: Number(next) })} />
          )}

          {bgMode === 'solid' && (
            <div className="style-panel-box">
              <StyleColorLine label="배경색" value={draftTheme.bgSolid || draftTheme.bg} onChange={(next) => updateDraft({ bgSolid: next, bg: next, bgPreset: 'custom' })} />
              <div className="style-line style-preset-line">
                <span>추천색</span>
                <div className="style-preset-row-v16">
                  {bgPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={(draftTheme.bg || draftTheme.bgSolid) === color ? 'active' : ''}
                      style={{ background: color }}
                      onClick={() => updateDraft({ bg: color, bgSolid: color, bgPreset: color })}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {bgMode === 'gradient' && (
            <div className="style-panel-box">
              <StyleColorLine label="시작" value={draftTheme.gradientFrom || '#F5F7FA'} onChange={(next) => updateDraft({ gradientFrom: next })} />
              <StyleColorLine label="끝" value={draftTheme.gradientTo || '#EAF2FF'} onChange={(next) => updateDraft({ gradientTo: next })} />
              <StyleRangeLine label="비율" value={draftTheme.gradientRatio ?? 50} min={0} max={100} suffix="%" onChange={(next) => updateDraft({ gradientRatio: Number(next) })} />
            </div>
          )}

          {bgMode === 'image' && (
            <div className="style-panel-box style-photo-box">
              <div className="style-photo-upload">
                <ImageInput label="배경 사진" value={draftTheme.bgImage} onChange={(next) => updateDraft({ bgImage: next, bgOverlay: draftTheme.bgOverlay ?? true })} />
              </div>

              <StyleSegment
                label="맞춤"
                value={draftTheme.bgImageFit || 'cover'}
                onChange={(next) => updateDraft({ bgImageFit: next })}
                options={[['cover', '채우기'], ['contain', '전체'], ['auto', '원본']]}
              />

              <StyleSegment
                label="위치"
                value={draftTheme.bgImagePosition || 'center'}
                onChange={(next) => updateDraft({ bgImagePosition: next })}
                options={[['center', '중앙'], ['top', '상단'], ['bottom', '하단']]}
              />

              <div className="style-overlay-card-v16">
                <div className="style-overlay-title">
                  <strong>오버레이</strong>
                  <button type="button" className={draftTheme.bgOverlay !== false ? 'active' : ''} onClick={() => updateDraft({ bgOverlay: !(draftTheme.bgOverlay !== false) })}>
                    {draftTheme.bgOverlay !== false ? 'ON' : 'OFF'}
                  </button>
                </div>

                {draftTheme.bgOverlay !== false && (
                  <>
                    <StyleColorLine label="색상" value={draftTheme.bgOverlayColor || '#F5F7FA'} onChange={(next) => updateDraft({ bgOverlayColor: next })} />
                    <StyleRangeLine label="농도" value={draftTheme.bgOverlayOpacity ?? 72} min={0} max={90} suffix="%" onChange={(next) => updateDraft({ bgOverlayOpacity: Number(next) })} />
                  </>
                )}
              </div>

              <div
                className="style-bg-preview-v16"
                style={{
                  background: getPageBg(draftTheme),
                  backgroundSize: draftTheme.bgImageFit === 'contain' ? 'contain' : draftTheme.bgImageFit === 'auto' ? 'auto' : 'cover',
                  backgroundPosition: draftTheme.bgImagePosition || 'center',
                }}
              />
            </div>
          )}
        </section>
      )}

      {section === 'color' && (
        <section className="card style-card">
          <div className="section-title"><h2>색상</h2></div>
          <div className="style-panel-box">
            <StyleColorLine label="버튼" value={draftTheme.accent} onChange={(next) => updateDraft({ accent: next })} />
            <StyleSegment
              label="버튼 효과"
              value={normalizeButtonEffect(draftTheme.buttonEffect)}
              onChange={(next) => updateDraft({ buttonEffect: next })}
              options={[['fill', '리프트'], ['shine', '라이트 스윕'], ['burst', '팝 1회']]}
            />
            <StyleColorLine label="카드" value={draftTheme.card} onChange={(next) => updateDraft({ card: next })} />
            <StyleSegment label="라운드" value={String(draftTheme.radius)} onChange={(next) => updateDraft({ radius: Number(next) })} options={[['16', 'S'], ['24', 'M'], ['32', 'L']]} />
          </div>
        </section>
      )}

      {section === 'text' && (
        <section className="card style-card">
          <div className="section-title"><h2>텍스트</h2></div>
          <div className="style-panel-box">
            <StyleColorLine label="글자색" value={draftTheme.text} onChange={(next) => updateDraft({ text: next })} />
            <StyleSegment label="전체 정렬" value={draftTheme.globalAlign || 'left'} onChange={updateAllAlign} options={[['left', '왼쪽'], ['center', '중앙'], ['right', '오른쪽']]} />
            <StyleSegment label="톤" value={draftTheme.font} onChange={(next) => updateDraft({ font: next })} options={[['modern', '기본'], ['soft', '부드럽게'], ['bold', '강하게']]} />
            <StyleSegment label="글꼴" value={draftTheme.fontFamily || 'pretendard'} onChange={(next) => updateDraft({ fontFamily: next })} options={[['pretendard', 'Pretendard'], ['noto', 'Noto'], ['serif', 'Serif']]} />
          </div>
        </section>
      )}

      <section className="card style-card style-widget-card">
        <div className="section-title"><h2>위젯 스타일</h2></div>
        <div className="style-widget-dropdown">
          <label>
            <span>수정할 위젯</span>
            <select value={selectedBlock?.id || ''} onChange={(event) => setSelectedBlockId(event.target.value)}>
              {styleBlocks.map((block, index) => (
                <option key={block.id} value={block.id}>
                  {blockLabel(block, index)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="style-panel-box style-widget-controls">
          <WidgetStyleControls block={selectedBlock} update={updateSelectedWidget} />
        </div>
      </section>
    </div>
  );
}

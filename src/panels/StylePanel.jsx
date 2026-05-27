import { useEffect, useMemo, useState } from 'react';
import { Pipette } from 'lucide-react';
import { ImageInput } from '../editor/controls.jsx';
import { confirmAction, notify } from '../lib/uiFeedback.js';
import './StylePanel.css';

function StyleSegment({ label, value, onChange, options }) {
  return (
    <div className="style-line style-segment-line">
      <span>{label}</span>
      <div className="style-segment">
        {options.map(([key, text]) => (
          <button key={key} type="button" className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
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
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} />
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
        <input type="range" min={min} max={max} value={value ?? 0} onChange={(e) => onChange(e.target.value)} />
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
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
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

export default function StylePanel({ page, updateTheme, onPreviewThemeChange }) {
  const [section, setSection] = useState('background');
  const [draftTheme, setDraftTheme] = useState(page.theme || {});
  const bgPresets = ['#F5F7FA', '#FFFFFF', '#EEF2FF', '#F8F3EA', '#111827'];
  const bgMode = draftTheme.bgMode || 'solid';
  const dirty = useMemo(
    () => JSON.stringify(draftTheme) !== JSON.stringify(page.theme || {}),
    [draftTheme, page.theme],
  );

  useEffect(() => {
    setDraftTheme(page.theme || {});
  }, [page.theme]);

  useEffect(() => {
    onPreviewThemeChange?.(draftTheme);
  }, [draftTheme, onPreviewThemeChange]);

  useEffect(() => {
    return () => onPreviewThemeChange?.(null);
  }, [onPreviewThemeChange]);

  const updateDraft = (patch) => {
    setDraftTheme((theme) => ({ ...theme, ...patch }));
  };

  const applyStyle = async () => {
    if (!dirty) {
      notify('변경된 스타일 설정이 없습니다.');
      return;
    }

    const ok = await confirmAction({
      title: '스타일 설정을 적용할까요?',
      message: '현재 설정한 스타일 값이 미리보기에 적용됩니다. 저장 버튼을 눌러야 서버 저장까지 완료됩니다.',
      confirmLabel: '적용',
    });
    if (!ok) return;
    updateTheme(draftTheme);
    onPreviewThemeChange?.(null);
    notify('스타일 설정이 적용되었습니다.', 'success');
  };

  const resetDraft = () => {
    setDraftTheme(page.theme || {});
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
            onChange={(v) => updateDraft({ bgMode: v, bgOverlay: v === 'image' ? (draftTheme.bgOverlay ?? true) : draftTheme.bgOverlay })}
            options={[["solid", "단색"], ["gradient", "그라데이션"], ["image", "사진"]]}
          />
          <StyleSegment
            label="배경 효과"
            value={draftTheme.bgEffect || 'none'}
            onChange={(v) => updateDraft({ bgEffect: v })}
            options={[["none", "없음"], ["snow", "눈"], ["petals", "꽃잎"], ["sparkle", "반짝임"]]}
          />
          {(draftTheme.bgEffect || 'none') !== 'none' && (
            <StyleRangeLine label="효과 농도" value={draftTheme.bgEffectOpacity ?? 45} min={10} max={90} suffix="%" onChange={(v) => updateDraft({ bgEffectOpacity: Number(v) })} />
          )}

          {bgMode === 'solid' && (
            <div className="style-panel-box">
              <StyleColorLine label="배경색" value={draftTheme.bgSolid || draftTheme.bg} onChange={(v) => updateDraft({ bgSolid: v, bg: v, bgPreset: 'custom' })} />
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
              <StyleColorLine label="시작" value={draftTheme.gradientFrom || '#F5F7FA'} onChange={(v) => updateDraft({ gradientFrom: v })} />
              <StyleColorLine label="끝" value={draftTheme.gradientTo || '#EAF2FF'} onChange={(v) => updateDraft({ gradientTo: v })} />
              <StyleRangeLine label="비율" value={draftTheme.gradientRatio ?? 50} min={0} max={100} suffix="%" onChange={(v) => updateDraft({ gradientRatio: Number(v) })} />
            </div>
          )}

          {bgMode === 'image' && (
            <div className="style-panel-box style-photo-box">
              <div className="style-photo-upload">
                <ImageInput label="배경 사진" value={draftTheme.bgImage} onChange={(v) => updateDraft({ bgImage: v, bgOverlay: draftTheme.bgOverlay ?? true })} />
              </div>

              <StyleSegment
                label="맞춤"
                value={draftTheme.bgImageFit || 'cover'}
                onChange={(v) => updateDraft({ bgImageFit: v })}
                options={[["cover", "채우기"], ["contain", "전체"], ["auto", "원본"]]}
              />

              <StyleSegment
                label="위치"
                value={draftTheme.bgImagePosition || 'center'}
                onChange={(v) => updateDraft({ bgImagePosition: v })}
                options={[["center", "중앙"], ["top", "상단"], ["bottom", "하단"]]}
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
                    <StyleColorLine label="색상" value={draftTheme.bgOverlayColor || '#F5F7FA'} onChange={(v) => updateDraft({ bgOverlayColor: v })} />
                    <StyleRangeLine label="농도" value={draftTheme.bgOverlayOpacity ?? 72} min={0} max={90} suffix="%" onChange={(v) => updateDraft({ bgOverlayOpacity: Number(v) })} />
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
            <StyleColorLine label="버튼" value={draftTheme.accent} onChange={(v) => updateDraft({ accent: v })} />
            <StyleSegment
              label="버튼 효과"
              value={normalizeButtonEffect(draftTheme.buttonEffect)}
              onChange={(v) => updateDraft({ buttonEffect: v })}
              options={[["fill", "리프트"], ["shine", "라이트 스윕"], ["burst", "팝 1회"]]}
            />
            <StyleColorLine label="카드" value={draftTheme.card} onChange={(v) => updateDraft({ card: v })} />
            <StyleSegment label="라운드" value={String(draftTheme.radius)} onChange={(v) => updateDraft({ radius: Number(v) })} options={[["16", "S"], ["24", "M"], ["32", "L"]]} />
          </div>
        </section>
      )}

      {section === 'text' && (
        <section className="card style-card">
          <div className="section-title"><h2>텍스트</h2></div>
          <div className="style-panel-box">
            <StyleColorLine label="글자색" value={draftTheme.text} onChange={(v) => updateDraft({ text: v })} />
            <StyleSegment label="톤" value={draftTheme.font} onChange={(v) => updateDraft({ font: v })} options={[["modern", "기본"], ["soft", "부드럽게"], ["bold", "강하게"]]} />
            <StyleSegment label="글꼴" value={draftTheme.fontFamily || 'pretendard'} onChange={(v) => updateDraft({ fontFamily: v })} options={[["pretendard", "Pretendard"], ["noto", "Noto"], ["serif", "Serif"]]} />
          </div>
        </section>
      )}
    </div>
  );
}

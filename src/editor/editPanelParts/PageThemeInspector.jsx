import React from 'react';
import { Pipette } from 'lucide-react';
import { ImageInput } from '../controls.jsx';
import { notify } from '../../lib/uiFeedback.js';

const BG_PRESETS = ['#F5F7FA', '#FFFFFF', '#EEF2FF', '#F8F3EA', '#111827'];

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function Segment({ value, options, onChange, ariaLabel }) {
  return (
    <div className="inspector-segment" role="group" aria-label={ariaLabel}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={String(value) === String(key) ? 'active' : ''}
          aria-pressed={String(value) === String(key)}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ColorField({ label, value, fallback, onChange }) {
  const color = safeColor(value, fallback);
  const pick = async () => {
    if (!window.EyeDropper) {
      notify('이 브라우저에서는 색상 추출 기능을 사용할 수 없습니다.', 'error');
      return;
    }
    try {
      const result = await new window.EyeDropper().open();
      if (result?.sRGBHex) onChange(result.sRGBHex);
    } catch {}
  };

  return (
    <label className="inspector-field inspector-color-field">
      <span>{label}</span>
      <div>
        <input type="color" value={color} onChange={(event) => onChange(event.target.value)} />
        <b>{color}</b>
        <button type="button" onClick={pick} aria-label={`${label} 색상 추출`}><Pipette size={15} /></button>
      </div>
    </label>
  );
}

function RangeField({ label, value, min = 0, max = 100, suffix = '', onChange }) {
  return (
    <label className="inspector-field inspector-range-field">
      <span>{label}</span>
      <div>
        <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <b>{value}{suffix}</b>
      </div>
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

export function PageThemeInspector({ page, updateTheme }) {
  const [section, setSection] = React.useState('background');
  const theme = page?.theme || {};
  const update = (patch) => updateTheme?.(patch);
  const bgMode = theme.bgMode || 'solid';
  const bgEffect = theme.bgEffect || 'none';

  return (
    <section className="page-theme-inspector" aria-label="페이지 테마">
      <nav className="page-theme-nav" aria-label="테마 설정">
        {[
          ['background', '배경'],
          ['color', '색상'],
          ['text', '글자'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'active' : ''}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === 'background' && (
        <div className="page-theme-fields">
          <div className="inspector-field">
            <span>종류</span>
            <Segment
              ariaLabel="배경 종류"
              value={bgMode}
              onChange={(next) => update({ bgMode: next, bgOverlay: next === 'image' ? (theme.bgOverlay ?? true) : theme.bgOverlay })}
              options={[[ 'solid', '단색' ], [ 'gradient', '그라데이션' ], [ 'image', '이미지' ]]}
            />
          </div>

          <SelectField
            label="효과"
            value={bgEffect}
            onChange={(next) => update({ bgEffect: next })}
            options={[[ 'none', '없음' ], [ 'snow', '눈' ], [ 'petals', '꽃잎' ], [ 'sparkle', '반짝임' ]]}
          />

          {bgEffect !== 'none' && (
            <RangeField
              label="효과 투명도"
              value={theme.bgEffectOpacity ?? 45}
              min={10}
              max={90}
              suffix="%"
              onChange={(next) => update({ bgEffectOpacity: next })}
            />
          )}

          {bgMode === 'solid' && (
            <>
              <ColorField
                label="배경색"
                value={theme.bgSolid || theme.bg}
                fallback="#F5F7FA"
                onChange={(next) => update({ bgSolid: next, bg: next, bgPreset: 'custom' })}
              />
              <div className="inspector-field">
                <span>빠른 색상</span>
                <div className="inspector-color-presets">
                  {BG_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={(theme.bgSolid || theme.bg) === color ? 'active' : ''}
                      style={{ background: color }}
                      aria-label={color}
                      onClick={() => update({ bg: color, bgSolid: color, bgPreset: color })}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {bgMode === 'gradient' && (
            <>
              <ColorField
                label="시작색"
                value={theme.gradientFrom}
                fallback="#F5F7FA"
                onChange={(next) => update({ gradientFrom: next })}
              />
              <ColorField
                label="끝색"
                value={theme.gradientTo}
                fallback="#EAF2FF"
                onChange={(next) => update({ gradientTo: next })}
              />
              <RangeField
                label="비율"
                value={theme.gradientRatio ?? 50}
                suffix="%"
                onChange={(next) => update({ gradientRatio: next })}
              />
            </>
          )}

          {bgMode === 'image' && (
            <>
              <div className="inspector-image-field">
                <ImageInput
                  label="배경 이미지"
                  value={theme.bgImage}
                  onChange={(next) => update({ bgImage: next, bgOverlay: theme.bgOverlay ?? true })}
                />
              </div>
              <SelectField
                label="이미지 맞춤"
                value={theme.bgImageFit || 'cover'}
                onChange={(next) => update({ bgImageFit: next })}
                options={[[ 'cover', '채우기' ], [ 'contain', '전체 보기' ], [ 'auto', '원본' ]]}
              />
              <SelectField
                label="위치"
                value={theme.bgImagePosition || 'center'}
                onChange={(next) => update({ bgImagePosition: next })}
                options={[[ 'center', '가운데' ], [ 'top', '위' ], [ 'bottom', '아래' ]]}
              />
              <div className="inspector-field inspector-toggle-field">
                <span>덮개</span>
                <button
                  type="button"
                  className={theme.bgOverlay !== false ? 'active' : ''}
                  aria-pressed={theme.bgOverlay !== false}
                  onClick={() => update({ bgOverlay: !(theme.bgOverlay !== false) })}
                >
                  {theme.bgOverlay !== false ? '사용' : '사용 안 함'}
                </button>
              </div>
              {theme.bgOverlay !== false && (
                <>
                  <ColorField
                    label="덮개 색상"
                    value={theme.bgOverlayColor}
                    fallback="#F5F7FA"
                    onChange={(next) => update({ bgOverlayColor: next })}
                  />
                  <RangeField
                    label="덮개 투명도"
                    value={theme.bgOverlayOpacity ?? 72}
                    min={0}
                    max={90}
                    suffix="%"
                    onChange={(next) => update({ bgOverlayOpacity: next })}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}

      {section === 'color' && (
        <div className="page-theme-fields">
          <ColorField
            label="포인트색"
            value={theme.accent}
            fallback="#2563EB"
            onChange={(next) => update({ accent: next })}
          />
        </div>
      )}

      {section === 'text' && (
        <div className="page-theme-fields">
          <ColorField
            label="글자색"
            value={theme.text}
            fallback="#111827"
            onChange={(next) => update({ text: next })}
          />
          <div className="inspector-field">
            <span>정렬</span>
            <Segment
              ariaLabel="전체 정렬"
              value={theme.globalAlign || 'left'}
              onChange={(next) => update({ globalAlign: next })}
              options={[[ 'left', '왼쪽' ], [ 'center', '가운데' ], [ 'right', '오른쪽' ]]}
            />
          </div>
          <SelectField
            label="글꼴"
            value={theme.fontFamily || 'pretendard'}
            onChange={(next) => update({ fontFamily: next })}
            options={[[ 'pretendard', 'Pretendard' ], [ 'noto', 'Noto' ], [ 'serif', 'Serif' ]]}
          />
          <SelectField
            label="분위기"
            value={theme.font || 'modern'}
            onChange={(next) => update({ font: next })}
            options={[[ 'modern', '모던' ], [ 'soft', '부드럽게' ], [ 'bold', '강하게' ]]}
          />
        </div>
      )}
    </section>
  );
}

// A curated, reversible starting point. All values are existing page theme
// fields; onPick only updates the staged design until Apply is pressed.
const looks = [
  { id: 'clean', title: '깔끔한 모던', caption: '맑고 정돈된 느낌',
    bg: '#FFFFFF', text: '#19283D', accent: '#255CEC', fontFamily: 'pretendard', font: 'modern' },
  { id: 'warm', title: '따뜻한 감성', caption: '베이지와 테라코타',
    bg: '#FBF4EB', text: '#493D34', accent: '#A64A33', fontFamily: 'serif', font: 'soft' },
  { id: 'soft', title: '부드러운 라일락', caption: '화사하고 섬세하게',
    bg: '#F3F1FD', text: '#2D2545', accent: '#7256C7', fontFamily: 'pretendard', font: 'soft' },
  { id: 'dark', title: '프리미엄 다크', caption: '선명하고 묵직하게',
    bg: '#131E30', text: '#F9FAFF', accent: '#5A45CF', fontFamily: 'pretendard', font: 'bold' },
];

function matchesLook(theme, look) {
  return (theme.bgMode || 'solid') === 'solid'
    && (theme.bgSolid || theme.bg || '#F5F7FA').toLowerCase() === look.bg.toLowerCase()
    && (theme.accent || '#2563EB').toLowerCase() === look.accent.toLowerCase()
    && (theme.text || '#111827').toLowerCase() === look.text.toLowerCase()
    && (theme.fontFamily || 'pretendard') === look.fontFamily;
}

export default function PageDesignPresets({ theme, onPick }) {
  return (
    <section className="page-design-presets" aria-label="빠른 전체 디자인">
      <div className="page-design-presets-heading">
        <h3>디자인 한 번에 고르기</h3>
        <p>누르면 실제 페이지에서 바로 미리 볼 수 있어요.</p>
      </div>
      <div className="page-design-presets-grid" role="group" aria-label="완성형 디자인">
        {looks.map((look) => (
          <button
            key={look.id}
            type="button"
            className="page-design-preset"
            aria-pressed={matchesLook(theme, look)}
            onClick={() => onPick({
              bgMode: 'solid',
              bg: look.bg,
              bgSolid: look.bg,
              bgPreset: look.bg,
              accent: look.accent,
              text: look.text,
              fontFamily: look.fontFamily,
              font: look.font,
              globalAlign: '',
              bgEffect: 'none',
            })}
          >
            <span
              className="page-design-preset-scene"
              style={{ background: look.bg, color: look.text }}
              aria-hidden="true"
            >
              <span className="page-design-preset-topbar" style={{ backgroundColor: look.text }} />
              <span className="page-design-preset-headline" style={{ backgroundColor: look.text }} />
              <span className="page-design-preset-copy" style={{ backgroundColor: look.text }} />
              <span className="page-design-preset-action" style={{ backgroundColor: look.accent }} />
              <span className="page-design-preset-photo" style={{ borderColor: look.accent }} />
            </span>
            <span className="page-design-preset-name">{look.title}</span>
            <span className="page-design-preset-caption">{look.caption}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

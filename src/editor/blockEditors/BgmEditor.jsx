import { EditorTabs } from '../ui/index.js';

function ToggleRow({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function BgmEditor({ s, set }) {
  const volume = Math.max(0, Math.min(100, Number(s.volume ?? 70)));

  return (
    <EditorTabs
      tabs={[{
        id: 'bgm',
        label: 'BGM',
        content: (
          <div style={{ display: 'grid', gap: 14 }}>
            <label className="field">
              <span>음원 URL</span>
              <input
                type="url"
                value={s.bgmSrc || ''}
                onChange={(event) => set({ bgmSrc: event.target.value })}
                placeholder="https://example.com/music.mp3"
              />
            </label>

            <p style={{ margin: 0, color: '#64748b', fontSize: 12, lineHeight: 1.55 }}>
              MP3, M4A, OGG처럼 브라우저에서 직접 재생되는 음원 주소를 입력하세요.
            </p>

            <label className="field">
              <span>표시 이름</span>
              <input
                value={s.bgmLabel ?? 'BGM'}
                onChange={(event) => set({ bgmLabel: event.target.value })}
                placeholder="BGM"
              />
            </label>

            <div style={{ display: 'grid', gap: 4, padding: '4px 0' }}>
              <ToggleRow label="자동 재생" checked={s.autoplay !== false} onChange={(autoplay) => set({ autoplay })} />
              <ToggleRow label="반복 재생" checked={s.loop !== false} onChange={(loop) => set({ loop })} />
              <ToggleRow label="재생 버튼 표시" checked={s.showControl !== false} onChange={(showControl) => set({ showControl })} />
            </div>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontSize: 13, fontWeight: 800 }}>
                <span>음량</span>
                <b>{volume}%</b>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                onChange={(event) => set({ volume: Number(event.target.value) })}
              />
            </label>

            <p style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', color: '#64748b', fontSize: 12, lineHeight: 1.55 }}>
              모바일 브라우저가 소리 자동재생을 막는 경우 첫 화면 터치 후 자동으로 다시 재생을 시도합니다.
            </p>
          </div>
        ),
      }]}
    />
  );
}
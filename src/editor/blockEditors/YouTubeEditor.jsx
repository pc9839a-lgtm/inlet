import { EditorTabs } from '../ui/index.js';
import { createYouTubeCodeSettings, getYouTubeVideoId } from '../../lib/youtubeEmbed.js';

export default function YouTubeEditor({ s, set }) {
  const value = String(s.youtubeUrl || '');
  const valid = !!getYouTubeVideoId(value);
  const hasValue = !!value.trim();

  const updateUrl = (nextValue) => {
    set(createYouTubeCodeSettings(nextValue));
  };

  return (
    <EditorTabs
      tabs={[{
        id: 'video',
        label: '영상',
        content: (
          <>
            <label className="field">
              <span>YouTube 주소</span>
              <div>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://youtu.be/..."
                  value={value}
                  onChange={(event) => updateUrl(event.target.value)}
                />
              </div>
            </label>
            <p style={{ margin: '8px 2px 0', color: hasValue && !valid ? '#dc2626' : '#64748b', fontSize: '12px', lineHeight: 1.5, fontWeight: 800 }}>
              {hasValue && !valid
                ? 'YouTube 영상 주소를 확인해주세요.'
                : '일반 영상, Shorts, 공유 링크를 붙여넣으면 페이지 안에 바로 표시됩니다.'}
            </p>
          </>
        ),
      }]}
    />
  );
}

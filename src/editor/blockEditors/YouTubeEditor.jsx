import { EditorTabs } from '../ui/index.js';
import { createVideoCodeSettings, getVideoSource } from '../../lib/youtubeEmbed.js';

export default function YouTubeEditor({ s, set }) {
  const value = String(s.videoUrl || s.youtubeUrl || '');
  const valid = !!getVideoSource(value);
  const hasValue = !!value.trim();

  const updateUrl = (nextValue) => {
    set(createVideoCodeSettings(nextValue));
  };

  return (
    <EditorTabs
      tabs={[{
        id: 'video',
        label: '영상',
        content: (
          <>
            <label className="field">
              <span>동영상 주소</span>
              <div>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://youtu.be/... 또는 https://.../video.mp4"
                  value={value}
                  onChange={(event) => updateUrl(event.target.value)}
                />
              </div>
            </label>
            <p style={{ margin: '8px 2px 0', color: hasValue && !valid ? '#dc2626' : '#64748b', fontSize: '12px', lineHeight: 1.5, fontWeight: 800 }}>
              {hasValue && !valid
                ? '지원하는 동영상 주소인지 확인해주세요.'
                : '지원: YouTube 일반·Shorts·Live·공유 링크, Vimeo, MP4·WebM·Ogg 직접 링크'}
            </p>
          </>
        ),
      }]}
    />
  );
}

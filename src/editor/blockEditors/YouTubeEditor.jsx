import { useRef, useState } from 'react';
import { EditorTabs } from '../ui/index.js';
import { createVideoCodeSettings, getVideoSource } from '../../lib/youtubeEmbed.js';

const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg']);

function fileSizeLabel(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

export default function YouTubeEditor({ s, set }) {
  const value = String(s.videoUrl || s.youtubeUrl || '');
  const source = getVideoSource(value);
  const uploadedFile = s.widgetMode === 'video-file' && !!s.videoFileName && !value;
  const valid = !!source || uploadedFile;
  const hasValue = !!value.trim() || uploadedFile;
  const fileRef = useRef(null);
  const [fileError, setFileError] = useState('');
  const [readingFile, setReadingFile] = useState(false);

  const updateUrl = (nextValue) => {
    setFileError('');
    set(createVideoCodeSettings(nextValue));
  };

  const pickVideo = (file) => {
    if (!file || readingFile) return;
    setFileError('');
    if (!VIDEO_TYPES.has(String(file.type || '').toLowerCase())) {
      setFileError('MP4, WebM, Ogg 영상만 업로드할 수 있습니다.');
      return;
    }
    if (Number(file.size || 0) > MAX_VIDEO_BYTES) {
      setFileError('영상은 8MB 이하로 최적화해서 올려주세요.');
      return;
    }

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = String(reader.result || '');
        if (!dataUrl.startsWith('data:video/')) throw new Error('영상 파일을 읽지 못했습니다.');
        set(createVideoCodeSettings(dataUrl, { fileName: file.name || '업로드 영상' }));
      } catch (error) {
        setFileError(error?.message || '영상 파일을 읽지 못했습니다.');
      } finally {
        setReadingFile(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setReadingFile(false);
      setFileError('영상 파일을 읽지 못했습니다.');
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const clearVideo = () => {
    setFileError('');
    set(createVideoCodeSettings(''));
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

            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg"
                style={{ display: 'none' }}
                onChange={(event) => pickVideo(event.target.files?.[0])}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={readingFile}
                  style={{ minHeight: 38, padding: '0 14px', border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff', color: '#0f172a', fontWeight: 800, cursor: readingFile ? 'wait' : 'pointer' }}
                >
                  {readingFile ? '영상 읽는 중...' : 'MP4 파일 선택'}
                </button>
                {hasValue && (
                  <button
                    type="button"
                    onClick={clearVideo}
                    style={{ minHeight: 38, padding: '0 14px', border: '1px solid #fecaca', borderRadius: 10, background: '#fff', color: '#b91c1c', fontWeight: 800, cursor: 'pointer' }}
                  >
                    영상 제거
                  </button>
                )}
              </div>
              {uploadedFile && (
                <div style={{ padding: '9px 11px', borderRadius: 10, background: '#f0fdf4', color: '#166534', fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>
                  업로드됨 · {s.videoFileName}
                </div>
              )}
            </div>

            <p style={{ margin: '8px 2px 0', color: fileError || (hasValue && !valid) ? '#dc2626' : '#64748b', fontSize: '12px', lineHeight: 1.5, fontWeight: 800 }}>
              {fileError
                || (hasValue && !valid
                  ? '지원하는 동영상 주소인지 확인해주세요.'
                  : (source?.kind === 'file' || uploadedFile)
                    ? '직접 영상은 원본 비율 그대로 자동재생 · 무음 · 무한반복됩니다.'
                    : '지원: YouTube, Vimeo, MP4·WebM·Ogg 직접 링크 또는 파일 업로드')}
            </p>
            <p style={{ margin: '4px 2px 0', color: '#94a3b8', fontSize: 11, lineHeight: 1.45, fontWeight: 700 }}>
              모바일 호환은 H.264 MP4 권장 · 최대 {fileSizeLabel(MAX_VIDEO_BYTES)}
            </p>
          </>
        ),
      }]}
    />
  );
}

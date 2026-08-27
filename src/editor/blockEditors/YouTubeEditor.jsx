import { useEffect, useRef, useState } from 'react';
import { EditorTabs } from '../ui/index.js';
import { uploadMediaFile } from '../../lib/fileRepository.js';
import { createVideoCodeSettings, getVideoSource } from '../../lib/youtubeEmbed.js';

const MAX_VIDEO_BYTES = 4 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg']);

function fileSizeLabel(bytes = 0) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

function videoExtension(type = '') {
  const mime = String(type || '').toLowerCase();
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  return 'mp4';
}

function ensureVideoFileName(name = '', type = '') {
  const clean = String(name || '').trim() || 'page-video';
  return /\.(mp4|webm|ogg|ogv)$/i.test(clean) ? clean : `${clean}.${videoExtension(type)}`;
}

export default function YouTubeEditor({ s, set, page, authUser }) {
  const rawValue = String(s.videoUrl || s.youtubeUrl || '');
  const embeddedFile = /^data:video\//i.test(rawValue);
  const source = getVideoSource(rawValue);
  const uploadedFile = source?.kind === 'file' && !!s.videoFileName;
  const value = embeddedFile || uploadedFile ? '' : rawValue;
  const valid = !!source;
  const hasValue = !!rawValue.trim();
  const fileRef = useRef(null);
  const migratedLegacyRef = useRef(false);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);

  const updateUrl = (nextValue) => {
    setFileError('');
    set(createVideoCodeSettings(nextValue));
  };

  const applyUploadResult = (result, fallbackName = '') => {
    const url = String(result?.downloadUrl || '').trim();
    if (!url) throw new Error('영상 업로드 주소를 받지 못했습니다.');
    set(createVideoCodeSettings(url, { fileName: result?.fileName || fallbackName || '업로드 영상' }));
  };

  const uploadVideo = async (file, fileName = '') => {
    const result = await uploadMediaFile(file, page, authUser, fileName || file?.name || 'page-video.mp4');
    applyUploadResult(result, fileName || file?.name || '업로드 영상');
  };

  const pickVideo = async (file) => {
    if (!file || uploading) return;
    setFileError('');
    if (!VIDEO_TYPES.has(String(file.type || '').toLowerCase())) {
      setFileError('MP4, WebM, Ogg 영상만 업로드할 수 있습니다.');
      return;
    }
    if (Number(file.size || 0) > MAX_VIDEO_BYTES) {
      setFileError(`영상은 ${fileSizeLabel(MAX_VIDEO_BYTES)} 이하로 최적화해서 올려주세요.`);
      return;
    }

    setUploading(true);
    try {
      await uploadVideo(file, file.name || 'page-video.mp4');
    } catch (error) {
      setFileError(error?.message || '영상 서버 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!embeddedFile || migratedLegacyRef.current || uploading) return;
    migratedLegacyRef.current = true;
    let cancelled = false;

    (async () => {
      setUploading(true);
      setFileError('');
      try {
        const response = await fetch(rawValue);
        const blob = await response.blob();
        if (!blob?.size) throw new Error('임시 영상 데이터가 비어 있습니다.');
        if (blob.size > MAX_VIDEO_BYTES) throw new Error(`영상은 ${fileSizeLabel(MAX_VIDEO_BYTES)} 이하로 최적화해서 올려주세요.`);
        if (cancelled) return;
        const fileName = ensureVideoFileName(s.videoFileName || 'page-video', blob.type);
        await uploadVideo(blob, fileName);
      } catch (error) {
        if (!cancelled) setFileError(error?.message || '기존 임시 영상을 서버 저장소로 옮기지 못했습니다. 영상을 다시 선택해주세요.');
      } finally {
        if (!cancelled) setUploading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embeddedFile, rawValue, s.videoFileName]);

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
                  placeholder={uploadedFile ? '업로드된 영상 사용 중' : 'https://youtu.be/... 또는 https://.../video.mp4'}
                  value={value}
                  disabled={uploadedFile || uploading}
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
                  disabled={uploading}
                  style={{ minHeight: 38, padding: '0 14px', border: '1px solid #dbe2ea', borderRadius: 10, background: '#fff', color: '#0f172a', fontWeight: 800, cursor: uploading ? 'wait' : 'pointer' }}
                >
                  {uploading ? '서버 업로드 중...' : uploadedFile ? '영상 교체' : 'MP4 파일 선택'}
                </button>
                {hasValue && !uploading && (
                  <button
                    type="button"
                    onClick={clearVideo}
                    style={{ minHeight: 38, padding: '0 14px', border: '1px solid #fecaca', borderRadius: 10, background: '#fff', color: '#b91c1c', fontWeight: 800, cursor: 'pointer' }}
                  >
                    영상 제거
                  </button>
                )}
              </div>
              {uploadedFile && !embeddedFile && (
                <div style={{ padding: '9px 11px', borderRadius: 10, background: '#f0fdf4', color: '#166534', fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>
                  서버 저장 완료 · {s.videoFileName}
                </div>
              )}
              {embeddedFile && uploading && (
                <div style={{ padding: '9px 11px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, lineHeight: 1.45, fontWeight: 800 }}>
                  기존 임시 영상을 서버 저장소로 옮기는 중입니다.
                </div>
              )}
            </div>

            <p style={{ margin: '8px 2px 0', color: fileError || (hasValue && !valid) ? '#dc2626' : '#64748b', fontSize: '12px', lineHeight: 1.5, fontWeight: 800 }}>
              {fileError
                || (hasValue && !valid
                  ? '지원하는 동영상 주소인지 확인해주세요.'
                  : source?.kind === 'file'
                    ? '직접 영상은 원본 비율 그대로 자동재생 · 무음 · 무한반복됩니다.'
                    : '지원: YouTube, Vimeo, MP4·WebM·Ogg 직접 링크 또는 파일 업로드')}
            </p>
            <p style={{ margin: '4px 2px 0', color: '#94a3b8', fontSize: 11, lineHeight: 1.45, fontWeight: 700 }}>
              영상 파일은 페이지 데이터가 아니라 서버 저장소(R2)에 저장됩니다 · 최대 {fileSizeLabel(MAX_VIDEO_BYTES)}
            </p>
          </>
        ),
      }]}
    />
  );
}

function isServerUploadedVideo(video) {
  const src = String(video.currentSrc || video.getAttribute?.('src') || '').trim();
  if (!src) return false;
  if (/^data:video\//i.test(src)) return true;
  try {
    const url = new URL(src, window.location.href);
    return url.origin === window.location.origin && url.pathname === '/api/files/download';
  } catch {
    return false;
  }
}

function detectBlackSidebars(video) {
  if (!isServerUploadedVideo(video)) return null;
  if (!video.videoWidth || !video.videoHeight) return null;

  try {
    const sampleWidth = Math.min(180, Math.max(72, Math.round(video.videoWidth / 6)));
    const sampleHeight = Math.max(72, Math.round(sampleWidth * (video.videoHeight / video.videoWidth)));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
    const pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;

    const top = Math.max(1, Math.floor(sampleHeight * 0.04));
    const bottom = Math.min(sampleHeight - 1, Math.ceil(sampleHeight * 0.96));
    const rows = Math.max(1, bottom - top);
    const blackRatioByColumn = new Array(sampleWidth).fill(0);

    for (let x = 0; x < sampleWidth; x += 1) {
      let black = 0;
      for (let y = top; y < bottom; y += 1) {
        const index = (y * sampleWidth + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const max = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        if (max <= 34 && avg <= 24) black += 1;
      }
      blackRatioByColumn[x] = black / rows;
    }

    const isMostlyBlack = (x) => blackRatioByColumn[x] >= 0.86;
    let left = 0;
    while (left < sampleWidth * 0.42 && isMostlyBlack(left)) left += 1;
    let right = 0;
    while (right < sampleWidth * 0.42 && isMostlyBlack(sampleWidth - 1 - right)) right += 1;

    const minBar = Math.max(4, Math.round(sampleWidth * 0.055));
    if (left < minBar || right < minBar) return null;
    if (Math.abs(left - right) > sampleWidth * 0.12) return null;

    const activeWidth = sampleWidth - left - right;
    if (activeWidth < sampleWidth * 0.42 || activeWidth > sampleWidth * 0.9) return null;

    const activeAspect = (video.videoWidth * (activeWidth / sampleWidth)) / video.videoHeight;
    if (!Number.isFinite(activeAspect) || activeAspect < 0.42 || activeAspect > 1.4) return null;

    return { left, right, activeAspect };
  } catch {
    return null;
  }
}

function applyAutoCrop(video) {
  const frame = video.parentElement;
  if (!frame || frame.dataset.pageroCropChecked === '1') return;
  frame.dataset.pageroCropChecked = '1';

  const crop = detectBlackSidebars(video);
  if (!crop) return;

  frame.classList.add('pagero-direct-auto-crop');
  frame.style.setProperty('--pagero-direct-content-ratio', String(crop.activeAspect));
}

function configureDirectVideo(video) {
  if (typeof HTMLVideoElement === 'undefined' || !(video instanceof HTMLVideoElement)) return;
  const widget = video.closest?.('.video-widget[data-video-runtime="direct-v2"]');
  if (!widget) return;

  const frame = video.parentElement;
  frame?.classList?.add('pagero-direct-loop-frame');
  widget.classList.add('pagero-direct-loop-widget');

  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.controls = false;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.removeAttribute('controls');

  const tryPlay = () => {
    try {
      const result = video.play();
      if (result && typeof result.catch === 'function') result.catch(() => undefined);
    } catch {}
  };

  const detectCrop = () => {
    window.requestAnimationFrame(() => applyAutoCrop(video));
  };

  if (video.readyState >= 2) {
    tryPlay();
    detectCrop();
  } else {
    video.addEventListener('loadeddata', detectCrop, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });
  }
}

function scanDirectVideos(root = document) {
  root?.querySelectorAll?.('.video-widget[data-video-runtime="direct-v2"] video').forEach(configureDirectVideo);
}

function installDirectVideoRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__pageroDirectVideoRuntimeInstalled) return;
  window.__pageroDirectVideoRuntimeInstalled = true;

  const start = () => {
    scanDirectVideos(document);
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('.video-widget[data-video-runtime="direct-v2"] video')) configureDirectVideo(node);
          scanDirectVideos(node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  ['pointerdown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, () => scanDirectVideos(document), { passive: true });
  });
}

installDirectVideoRuntime();

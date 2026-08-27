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

  if (video.readyState >= 2) tryPlay();
  else video.addEventListener('canplay', tryPlay, { once: true });
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

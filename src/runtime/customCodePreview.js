// Custom widgets can render and respond to clicks without inheriting the
// editor's session or sending submissions from an unpublished draft.
export const EDITOR_CODE_SANDBOX = 'allow-scripts';

export function isolateEditorCodeDocument(documentHtml = '') {
  const policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline' https: http:",
    'img-src data: blob: https: http:',
    'font-src data: https: http:',
    'media-src data: blob: https: http:',
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
  const guard = `<script>
    document.addEventListener('submit', (event) => event.preventDefault(), true);
    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('a[href], area[href]');
      if (link && !link.getAttribute('href').startsWith('#')) event.preventDefault();
    }, true);
  <\/script>`;
  // Put the policy before user-supplied head tags, scripts and resources, also
  // when the widget contains an entire HTML document instead of a fragment.
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">${guard}${String(documentHtml).replace(/^\s*<!doctype[^>]*>/i, '')}`;
}

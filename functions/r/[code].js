export async function onRequestGet({ params }) {
  const code = normalizeCode(params?.code);
  if (!code) {
    return new Response('추천인 코드가 올바르지 않습니다.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const appLink = `calltag://referral?code=${encodeURIComponent(code)}`;
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>콜태그 추천 혜택</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(440px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.08)}h1{font-size:25px;margin:0 0 10px}p{color:#475569;line-height:1.65;margin:0}.code{margin:22px 0 16px;padding:16px;border-radius:16px;background:#eff6ff;color:#1d4ed8;font-size:28px;font-weight:800;letter-spacing:.08em;text-align:center}.button{display:block;width:100%;padding:15px 18px;border:0;border-radius:14px;background:#2563eb;color:#fff;font-size:16px;font-weight:750;text-align:center;text-decoration:none}.help{font-size:13px;color:#64748b;margin-top:14px;text-align:center}</style>
</head>
<body>
  <main class="wrap"><section class="card">
    <h1>무료 이용 5일 추가</h1>
    <p>콜태그 앱을 열면 추천인 코드가 자동으로 저장됩니다. 로그인 또는 가입을 완료하면 최초 한 번 혜택이 적용됩니다.</p>
    <div class="code">${escapeHtml(code)}</div>
    <a class="button" href="${appLink}">콜태그 앱에서 혜택 받기</a>
    <p class="help">앱이 설치되지 않았다면 코드를 보관한 뒤 설치 후 직접 입력할 수 있습니다.</p>
  </section></main>
  <script>setTimeout(function(){ location.href=${JSON.stringify(appLink)}; },350);</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

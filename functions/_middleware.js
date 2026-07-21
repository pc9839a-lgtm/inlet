function redirectWwwToApex(requestUrl) {
  const target = new URL(requestUrl.toString());
  target.hostname = 'pagero.kr';
  target.protocol = 'https:';
  target.port = '';
  return Response.redirect(target.toString(), 301);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.toLowerCase() === 'www.pagero.kr') {
    return redirectWwwToApex(url);
  }

  return context.next();
}

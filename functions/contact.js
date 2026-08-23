import { servePageroStaticPage } from './lib/pageroStaticPageRoute.js';

export async function onRequest(context) {
  return servePageroStaticPage(context);
}

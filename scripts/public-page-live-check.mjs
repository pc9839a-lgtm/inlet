const baseUrl = normalizeBaseUrl(process.env.INLET_PUBLIC_API_URL || process.env.INLET_PUBLIC_QA_URL || '');
const slug = normalizeSlug(process.env.INLET_PUBLIC_PAGE_SLUG || process.env.INLET_PAGE_SLUG || '');
const expectedTitle = String(process.env.INLET_PUBLIC_PAGE_TITLE || '').trim();

function normalizeBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeSlug(value = '') {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

function skip(reason, extra = {}) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason,
    ...extra,
  }, null, 2));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store',
      Pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, text, data };
}

function fail(message, extra = {}) {
  console.error(JSON.stringify({
    ok: false,
    error: message,
    ...extra,
  }, null, 2));
  process.exitCode = 1;
}

if (!baseUrl || !slug) {
  skip('Set INLET_PUBLIC_API_URL and INLET_PUBLIC_PAGE_SLUG to verify a deployed public landing page.', {
    missing: [
      baseUrl ? '' : 'INLET_PUBLIC_API_URL',
      slug ? '' : 'INLET_PUBLIC_PAGE_SLUG',
    ].filter(Boolean),
  });
} else {
  const fresh = Date.now();
  const landingUrl = `${baseUrl}/${encodeURIComponent(slug)}?__fresh=${fresh}`;
  const apiUrl = `${baseUrl}/api/pages/${encodeURIComponent(slug)}?public=1&fresh=${fresh}`;

  try {
    const landing = await fetch(landingUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    });
    const landingText = await landing.text();
    if (!landing.ok || !/text\/html/i.test(landing.headers.get('content-type') || '')) {
      fail('Public landing route is not serving the app HTML.', {
        landingUrl,
        httpStatus: landing.status,
        contentType: landing.headers.get('content-type') || '',
        preview: landingText.slice(0, 300),
      });
    } else {
      const api = await fetchJson(apiUrl);
      if (!api.res.ok || !api.data?.page) {
        fail('Public page API cannot find the saved page for this slug.', {
          landingUrl,
          apiUrl,
          httpStatus: api.res.status,
          apiError: api.data?.error || api.data?.message || api.text.slice(0, 300),
          diagnosis: 'The route is deployed, but the page is not saved in the live API/D1 under this slug.',
        });
      } else {
        const page = api.data.page;
        if (String(page.slug || '') !== slug) {
          fail('Public page API returned a different slug.', {
            apiUrl,
            expectedSlug: slug,
            actualSlug: page.slug || '',
          });
        } else if (expectedTitle && String(page.title || '') !== expectedTitle) {
          fail('Public page API returned a different page title.', {
            apiUrl,
            expectedTitle,
            actualTitle: page.title || '',
          });
        } else {
          console.log(JSON.stringify({
            ok: true,
            skipped: false,
            landingUrl,
            apiUrl,
            page: {
              slug: page.slug || '',
              title: page.title || '',
              projectId: page.projectId || '',
              updatedAt: page.updatedAt || '',
              revision: page.revision || 0,
              blockCount: Array.isArray(page.blocks) ? page.blocks.length : 0,
            },
          }, null, 2));
        }
      }
    }
  } catch (error) {
    fail('Public page live check could not reach the deployed app.', {
      landingUrl,
      apiUrl,
      error: error?.message || String(error),
    });
  }
}

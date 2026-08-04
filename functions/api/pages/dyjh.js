import { decodeD1Page } from '../../../server/storage/d1Adapter.mjs';
import { assertD1, jsonResponse } from '../_shared.js';
import { onRequest as handleDynamicPageRequest } from './[slug].js';

const METHODS = 'GET, POST, DELETE, OPTIONS';
const PUBLIC_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': METHODS,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Inlet-Api-Token, X-Inlet-Owner-Id, X-Inlet-Project-Id, X-Inlet-Session',
  'Access-Control-Max-Age': '86400',
};

function publicPagePayload(page = {}) {
  return {
    ...page,
    ownership: undefined,
    ai: undefined,
    integrations: {
      conversion: page.integrations?.conversion || {},
    },
  };
}

async function handleRecoveredPublicRead({ request, env }) {
  const db = assertD1(env);
  const row = await db.prepare(`
    SELECT *
    FROM pages
    WHERE slug = 'dyjh'
    ORDER BY updated_at DESC, revision DESC, id DESC
    LIMIT 1
  `).first();

  if (!row) return null;
  const page = decodeD1Page(row);
  if (!page || !Array.isArray(page.blocks) || page.blocks.length === 0) return null;

  return jsonResponse(request, env, 200, {
    ok: true,
    page: publicPagePayload(page),
    recoveredPublicRead: true,
  }, METHODS, {
    cacheControl: 'no-store',
    headers: PUBLIC_HEADERS,
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const publicRead = context.request.method === 'GET' && url.searchParams.get('public') === '1';

  if (publicRead) {
    try {
      const response = await handleRecoveredPublicRead(context);
      if (response) return response;
    } catch (error) {
      console.error('dyjh public read fallback failed', error);
    }
  }

  return handleDynamicPageRequest({
    ...context,
    params: {
      ...(context.params || {}),
      slug: 'dyjh',
    },
  });
}

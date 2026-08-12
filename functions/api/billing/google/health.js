const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...JSON_HEADERS,
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
      },
    });
  }
  if (request.method !== 'GET') {
    return json(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const releaseEnabled = enabled(env.GOOGLE_PLAY_BILLING_ENABLED);
  const productsReady = enabled(env.GOOGLE_PLAY_PRODUCTS_READY);
  const clientEmail = String(env.GOOGLE_PLAY_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.GOOGLE_PLAY_PRIVATE_KEY || '').trim();
  const configured = !!(clientEmail && privateKey);
  const emailShapeValid = /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test(clientEmail);
  const normalizedKey = privateKey.replace(/\\n/g, '\n');
  const keyShapeValid = normalizedKey.includes('-----BEGIN PRIVATE KEY-----')
    && normalizedKey.includes('-----END PRIVATE KEY-----');

  const base = {
    ok: true,
    configured,
    emailShapeValid,
    keyShapeValid,
    releaseEnabled,
    productsReady,
  };

  if (!configured) {
    return json(200, {
      ...base,
      oauthToken: false,
      publisherAccess: false,
      code: 'PLAY_CREDENTIALS_MISSING',
    });
  }

  try {
    const oauth = await issueAccessToken(clientEmail, privateKey);
    const probe = await probePublisher(oauth.accessToken);
    return json(200, {
      ...base,
      oauthToken: true,
      oauthStatus: oauth.oauthStatus,
      publisherAccess: probe.publisherAccess,
      googleStatus: probe.googleStatus,
      code: probe.code,
    });
  } catch (error) {
    return json(200, {
      ...base,
      oauthToken: false,
      oauthStatus: Number(error?.oauthStatus || 0) || null,
      publisherAccess: false,
      code: safeCode(error),
    });
  }
}

async function issueAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlJson({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);

  let signature;
  try {
    signature = await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(unsigned),
    );
  } catch (cause) {
    throw coded('PLAY_JWT_SIGN_FAILED');
  }

  const assertion = `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch (cause) {
    throw coded('PLAY_OAUTH_NETWORK_FAILED');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const oauthError = String(body?.error || '').trim().toLowerCase();
    const error = coded(
      oauthError === 'invalid_grant'
        ? 'PLAY_OAUTH_INVALID_GRANT'
        : oauthError === 'invalid_client'
          ? 'PLAY_OAUTH_INVALID_CLIENT'
          : 'PLAY_OAUTH_TOKEN_FAILED',
    );
    error.oauthStatus = Number(response.status || 0);
    throw error;
  }
  return {
    accessToken: String(body.access_token),
    oauthStatus: Number(response.status || 200),
  };
}

async function probePublisher(accessToken) {
  const packageName = 'kr.pagero.calltag';
  const fakeToken = 'calltag-health-check-invalid-token';
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(fakeToken)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    },
  );

  const googleStatus = Number(response.status || 0);
  if (googleStatus === 401 || googleStatus === 403) {
    return {
      publisherAccess: false,
      googleStatus,
      code: 'PLAY_PUBLISHER_ACCESS_DENIED',
    };
  }
  if (googleStatus === 429 || googleStatus >= 500) {
    return {
      publisherAccess: null,
      googleStatus,
      code: 'PLAY_PUBLISHER_TEMPORARY_FAILURE',
    };
  }
  return {
    publisherAccess: true,
    googleStatus,
    code: 'PLAY_PUBLISHER_ACCESS_OK',
  };
}

async function importPrivateKey(value) {
  const pem = String(value || '').replace(/\\n/g, '\n');
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  if (!base64) throw coded('PLAY_PRIVATE_KEY_MISSING');

  let binary;
  try {
    binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch (cause) {
    throw coded('PLAY_PRIVATE_KEY_DECODE_FAILED');
  }
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      binary,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  } catch (cause) {
    throw coded('PLAY_PRIVATE_KEY_IMPORT_FAILED');
  }
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(
    String(value || '').trim().toLowerCase(),
  );
}

function coded(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function safeCode(error) {
  const code = String(error?.code || '').trim();
  return code && /^[A-Z0-9_]+$/.test(code) ? code : 'PLAY_AUTH_HEALTH_FAILED';
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

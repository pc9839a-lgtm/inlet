import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baseUrl = String(process.argv[2] || '').trim().replace(/\/$/, '');
const outputPath = path.resolve(root, '.deployment/calltag-push-readiness.json');
const endpoint = `${baseUrl}/api/call/push/readiness`;

if (!baseUrl.startsWith('https://')) {
  throw new Error('A deployed HTTPS base URL is required');
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });

let lastError = '';
let snapshot = null;
for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body?.ok === true) {
      snapshot = {
        checkedAt: new Date().toISOString(),
        deploymentUrl: baseUrl,
        endpoint,
        httpStatus: response.status,
        ready: body.ready === true,
        firebase: {
          configured: body?.firebase?.configured === true,
          projectId: body?.firebase?.projectId === true,
          clientEmail: body?.firebase?.clientEmail === true,
          privateKey: body?.firebase?.privateKey === true,
        },
        d1: {
          bound: body?.d1?.bound === true,
          pushDevicesTable: body?.d1?.pushDevicesTable === true,
        },
      };
      break;
    }
    lastError = `HTTP ${response.status}`;
  } catch (error) {
    lastError = String(error?.message || error || 'unknown error');
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

if (!snapshot) {
  snapshot = {
    checkedAt: new Date().toISOString(),
    deploymentUrl: baseUrl,
    endpoint,
    httpStatus: 0,
    ready: false,
    firebase: {
      configured: false,
      projectId: false,
      clientEmail: false,
      privateKey: false,
    },
    d1: {
      bound: false,
      pushDevicesTable: false,
    },
    error: lastError || 'readiness endpoint unavailable',
  };
}

await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log('CallTag push readiness:', JSON.stringify(snapshot));

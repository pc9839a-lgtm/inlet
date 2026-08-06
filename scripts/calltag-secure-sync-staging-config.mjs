import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const outputPath = path.resolve(process.argv[2] || '.tmp/calltag-staging-wrangler.jsonc');
const projectName = required('CALLTAG_STAGING_PAGES_PROJECT');
const databaseName = required('CALLTAG_STAGING_D1_DATABASE_NAME');
const databaseId = required('CALLTAG_STAGING_D1_DATABASE_ID');

if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(projectName)) {
  throw new Error('CALLTAG_STAGING_PAGES_PROJECT must be a valid Cloudflare project name');
}
if (!projectName.includes('staging') || ['inlet', 'pagero', 'calltag'].includes(projectName)) {
  throw new Error('Dedicated staging project name must contain "staging" and must not equal a production project name');
}
if (!databaseName.toLowerCase().includes('staging') || databaseName === 'inlet-prod') {
  throw new Error('Dedicated staging D1 database name must contain "staging"');
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(databaseId)) {
  throw new Error('CALLTAG_STAGING_D1_DATABASE_ID must be a D1 UUID');
}

const config = {
  $schema: './node_modules/wrangler/config-schema.json',
  name: projectName,
  compatibility_date: '2026-05-27',
  pages_build_output_dir: 'dist',
  vars: {
    INLET_AUTH_EMAIL_MODE: 'api',
    INLET_EMAIL_PROVIDER: 'mock',
    INLET_SUPPORT_EMAIL: 'support@pagero.kr',
    INLET_FILES_PROJECT_MAX_MB: '25',
    INLET_FILES_PROJECT_MAX_COUNT: '10',
    CALLTAG_SECURE_SYNC_ENABLED: '1',
    CALLTAG_SYNC_RETENTION_ENABLED: '0',
    CALLTAG_STAGING_ENVIRONMENT: '1',
  },
  d1_databases: [{
    binding: 'DB',
    database_name: databaseName,
    database_id: databaseId,
    migrations_dir: 'migrations',
  }],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  ok: true,
  outputPath,
  projectName,
  databaseName,
  secureSyncEnabled: true,
  retentionEnabled: false,
  productionBindingsIncluded: false,
}, null, 2));

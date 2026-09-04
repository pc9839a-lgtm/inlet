import { readFile } from 'node:fs/promises';
import { externalizeEmbeddedPageImages } from '../functions/api/pages/_pageAssets.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MemoryBucket {
  constructor() {
    this.objects = new Map();
    this.putCalls = [];
  }

  async head(key) {
    return this.objects.has(key) ? { key } : null;
  }

  async put(key, bytes, options = {}) {
    const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this.objects.set(key, { bytes: body, options });
    this.putCalls.push({ key, bytes: body, options });
  }
}

const pngA = `data:image/png;base64,${Buffer.from('image-a').toString('base64')}`;
const jpegB = `data:image/jpeg;base64,${Buffer.from('image-b').toString('base64')}`;
const bucket = new MemoryBucket();

const sourcePage = {
  title: 'R2 image test',
  hero: { image: pngA },
  blocks: [
    { type: 'image', src: pngA },
    { type: 'gallery', images: [pngA, jpegB] },
  ],
};

const result = await externalizeEmbeddedPageImages(
  sourcePage,
  { FILES_BUCKET: bucket },
  { projectId: 'project-1' },
);

const serialized = JSON.stringify(result.page);
assert(!serialized.includes('data:image/'), 'externalized page must not retain embedded data:image payloads');
assert(result.replaced === 2, `unique embedded image count must be 2: ${result.replaced}`);
assert(result.uploaded === 2, `two unique images must be uploaded once: ${result.uploaded}`);
assert(bucket.objects.size === 2, `R2 object count must be 2: ${bucket.objects.size}`);
assert(result.page.hero.image === result.page.blocks[0].src, 'duplicate embedded images must resolve to the same R2 URL');
assert(result.page.blocks[1].images[0] === result.page.hero.image, 'gallery duplicate must reuse the same content-addressed R2 URL');
assert(result.page.hero.image.startsWith('/api/files/download?key='), 'page must store a public asset URL instead of base64 data');
assert([...bucket.objects.keys()].every((key) => key.startsWith('project-1/images/')), 'page image objects must be isolated under the project images prefix');
assert([...bucket.objects.values()].every((object) => object.options?.customMetadata?.purpose === 'page-image'), 'R2 image objects must be tagged as page-image');
assert([...bucket.objects.values()].every((object) => /^image\//.test(object.options?.httpMetadata?.contentType || '')), 'R2 image objects must preserve image content type');

const repeat = await externalizeEmbeddedPageImages(
  sourcePage,
  { FILES_BUCKET: bucket },
  { projectId: 'project-1' },
);
assert(repeat.uploaded === 0, 're-saving identical images must reuse existing content-addressed R2 objects');
assert(bucket.objects.size === 2, 're-saving identical images must not grow R2 object count');

const urlOnlyPage = { hero: { image: result.page.hero.image } };
const noBucketNeeded = await externalizeEmbeddedPageImages(urlOnlyPage, {}, { projectId: 'project-1' });
assert(noBucketNeeded.page === urlOnlyPage && noBucketNeeded.replaced === 0, 'already externalized pages must not require an R2 binding');

let missingBucketError = null;
try {
  await externalizeEmbeddedPageImages({ image: pngA }, {}, { projectId: 'project-1' });
} catch (error) {
  missingBucketError = error;
}
assert(missingBucketError?.status === 503, 'embedded images without R2 binding must fail closed with 503');
assert(missingBucketError?.details?.code === 'PAGE_IMAGE_STORAGE_FAILED', 'missing R2 binding must expose PAGE_IMAGE_STORAGE_FAILED');

const routeSource = await readFile('functions/api/pages/[slug].js', 'utf8');
const downloadSource = await readFile('functions/api/files/download.js', 'utf8');
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

assert(routeSource.includes("import { externalizeEmbeddedPageImages } from './_pageAssets.js';"), 'page save route must import R2 image externalization');
const versionGuardIndex = routeSource.indexOf('      assertExpectedPageVersion({');
const externalizeIndex = routeSource.indexOf('      const assetResult = await externalizeEmbeddedPageImages(pageForSave, env, project);');
const d1WriteIndex = routeSource.indexOf('      const saved = await upsertD1Page(db, assetResult.page, {');
assert(versionGuardIndex >= 0 && externalizeIndex > versionGuardIndex, 'R2 writes must happen only after page revision validation');
assert(d1WriteIndex > externalizeIndex, 'D1 must receive the externalized URL page, never the embedded base64 page');
assert(routeSource.includes('pageAssets: {') && routeSource.includes('uploaded: assetResult.uploaded'), 'page save response must report page asset externalization diagnostics');

assert(downloadSource.includes('/^(?:image|video)\\//i.test(contentType)'), 'download route must render image assets inline');
assert(downloadSource.includes("purpose === 'page-image'"), 'download route must explicitly recognize page-image assets');
assert(downloadSource.includes("'Cache-Control': inlineMedia ? 'public, max-age=31536000, immutable'"), 'page image delivery must use immutable caching');

assert(packageJson.scripts?.['page:image:r2:qa'] === 'node scripts/page-image-r2-quality-check.mjs', 'page:image:r2:qa package script is missing');
assert(qaAllSource.includes("['page:image:r2:qa', ['scripts/page-image-r2-quality-check.mjs']]"), 'qa:all must enforce page image R2 externalization QA');

console.log(JSON.stringify({
  ok: true,
  scope: 'page-image-r2-externalization',
  uniqueImages: result.replaced,
  uploadedObjects: result.uploaded,
  contentAddressedDeduplication: true,
  d1StoresUrlsOnly: true,
  failClosedWithoutR2: true,
  inlineDelivery: true,
}, null, 2));

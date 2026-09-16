import { readFile } from 'node:fs/promises';
import {
  listProjectAssetObjects,
  projectImagesPrefix,
  projectMediaPrefix,
} from '../functions/api/files/_files.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MemoryBucket {
  constructor(objects = []) {
    this.objects = objects;
    this.calls = [];
  }

  async list(options = {}) {
    this.calls.push(options);
    const filtered = this.objects.filter((object) => String(object.key || '').startsWith(options.prefix || ''));
    const start = Number(options.cursor || 0) || 0;
    const limit = Math.max(1, Number(options.limit || 100));
    const page = filtered.slice(start, start + limit);
    const next = start + page.length;
    return {
      objects: page,
      truncated: next < filtered.length,
      cursor: next < filtered.length ? String(next) : undefined,
    };
  }
}

const bucket = new MemoryBucket([
  {
    key: 'project-a/images/hash-a.jpg',
    size: 120000,
    uploaded: new Date('2026-09-10T10:00:00.000Z'),
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: { purpose: 'page-image', projectId: 'project-a', uploadedAt: '2026-09-10T10:00:00.000Z' },
  },
  {
    key: 'project-a/images/hash-b.webp',
    size: 90000,
    uploaded: new Date('2026-09-11T10:00:00.000Z'),
    httpMetadata: { contentType: 'image/webp' },
    customMetadata: { purpose: 'page-image', projectId: 'project-a', uploadedAt: '2026-09-11T10:00:00.000Z' },
  },
  {
    key: 'project-a/media/2026-09-12/demo.mp4',
    size: 8000000,
    uploaded: new Date('2026-09-12T10:00:00.000Z'),
    httpMetadata: { contentType: 'video/mp4' },
    customMetadata: { purpose: 'media', projectId: 'project-a', originalName: '소개영상.mp4', uploadedAt: '2026-09-12T10:00:00.000Z' },
  },
  {
    key: 'project-b/images/private.png',
    size: 1000,
    uploaded: new Date('2026-09-13T10:00:00.000Z'),
    httpMetadata: { contentType: 'image/png' },
    customMetadata: { purpose: 'page-image', projectId: 'project-b', uploadedAt: '2026-09-13T10:00:00.000Z' },
  },
]);

assert(projectImagesPrefix('project-a') === 'project-a/images/', 'page image prefix must remain project-scoped');
assert(projectMediaPrefix('project-a') === 'project-a/media/', 'uploaded video prefix must remain project-scoped');

const firstImages = await listProjectAssetObjects(bucket, { projectId: 'project-a' }, 'image', { limit: 1 });
assert(firstImages.assets.length === 1, 'image list must honor bounded page size');
assert(firstImages.hasMore && firstImages.cursor === '1', 'image list must expose pagination cursor');
assert(firstImages.assets[0].key.startsWith('project-a/images/'), 'image result must stay inside requested project prefix');
assert(!firstImages.assets.some((asset) => asset.key.includes('project-b')), 'other project assets must never leak into image results');
assert(firstImages.assets[0].kind === 'image' && firstImages.assets[0].purpose === 'page-image', 'page image metadata must stay explicit');

const secondImages = await listProjectAssetObjects(bucket, { projectId: 'project-a' }, 'image', { limit: 1, cursor: firstImages.cursor });
assert(secondImages.assets.length === 1 && secondImages.assets[0].key.endsWith('hash-b.webp'), 'image pagination must continue from the supplied cursor');
assert(!secondImages.hasMore, 'final image page must close pagination');

const videos = await listProjectAssetObjects(bucket, { projectId: 'project-a' }, 'video', { limit: 10 });
assert(videos.assets.length === 1 && videos.assets[0].kind === 'video', 'video list must use the project media prefix');
assert(videos.assets[0].fileName === '소개영상.mp4', 'uploaded video must preserve original file name metadata');
assert(videos.assets[0].contentType === 'video/mp4', 'video content type must be exposed for preview');
assert(bucket.calls.every((call) => call.include?.includes('httpMetadata') && call.include?.includes('customMetadata')), 'asset list must request preview and display metadata from R2');

const [routeSource, repositorySource, settingsSource, mediaSource, cssSource, qaAllSource, packageSource] = await Promise.all([
  readFile('functions/api/files/list.js', 'utf8'),
  readFile('src/lib/fileRepository.js', 'utf8'),
  readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8'),
  readFile('src/panels/settings/MediaLibrarySettings.jsx', 'utf8'),
  readFile('src/panels/settings/MediaLibrarySettings.css', 'utf8'),
  readFile('scripts/qa-all.mjs', 'utf8'),
  readFile('package.json', 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

assert(routeSource.includes("authorizeProject(request, env, project, { tab: 'edit' })"), 'media asset listing must require edit-read project access');
assert(!routeSource.includes('publicWrite: true'), 'media asset listing must never be publicly readable');
assert(routeSource.includes('listProjectAssetObjects') && routeSource.includes('publicDownloadUrl'), 'media list endpoint must only expose project-scoped R2 assets through the existing download route');

assert(repositorySource.includes("/api/files/list?${params.toString()}") && repositorySource.includes('projectContext(page, authUser)'), 'client media listing must preserve project identity');
assert(repositorySource.includes('projectAuthHeaders(project, {})'), 'client media listing must send the existing authenticated project headers');
assert(repositorySource.includes("params.set('kind', kind === 'video' ? 'video' : 'image')"), 'client must constrain media list kinds');

assert(settingsSource.includes("['media', '미디어 보관함', Images]"), 'settings navigation must expose the media library');
assert(settingsSource.includes("id === 'media' && !canReadMedia"), 'settings navigation must hide media library without edit access');
assert(settingsSource.includes('<MediaLibrarySettings page={page} authUser={authUser} />'), 'settings must bind media library to the active page and authenticated user');

assert(mediaSource.includes("['all', `전체 ${imageCount + videoCount}`]") && mediaSource.includes("['image', `이미지 ${imageCount}`]") && mediaSource.includes("['video', `영상 ${videoCount}`]"), 'media library must provide all/image/video filters');
assert(mediaSource.includes('type="search"') && mediaSource.includes('assetSearchText'), 'media library must provide local asset search');
assert(mediaSource.includes("loadMore('image')") && mediaSource.includes("loadMore('video')"), 'media library must expose pagination for both asset kinds');
assert(mediaSource.includes('<img className="media-library-preview"') && mediaSource.includes('<video'), 'media library must preview both images and videos');
assert(mediaSource.includes('navigator.clipboard.writeText'), 'media library must let users copy an existing asset URL');
assert(!mediaSource.includes('deleteProjectAsset') && !mediaSource.includes('미디어 삭제'), 'foundation step must remain read-only and avoid destructive asset actions');

assert(cssSource.includes('@media (max-width: 720px)') && cssSource.includes('min-height: 44px'), 'media library mobile actions must retain 44px touch targets');
assert(packageJson.scripts?.['media:library:qa'] === 'node scripts/media-library-quality-check.mjs', 'media:library:qa package script missing');
assert(qaAllSource.includes("['media:library:qa', ['scripts/media-library-quality-check.mjs']]"), 'release QA must include media library coverage');

console.log(JSON.stringify({
  ok: true,
  scope: 'project-media-library-foundation',
  projectIsolation: true,
  imageVideoSeparation: true,
  pagination: true,
  editReadAuthorization: true,
  searchAndFilters: true,
  imageVideoPreview: true,
  destructiveActionsDeferred: true,
}, null, 2));

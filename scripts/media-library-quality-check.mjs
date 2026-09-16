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

const [
  routeSource,
  repositorySource,
  settingsSource,
  mediaSource,
  mediaCssSource,
  workspaceActiveSource,
  editPanelSource,
  editorMediaContextSource,
  imageControlsSource,
  imagePickerSource,
  imagePickerCssSource,
  imagePickerHookSource,
  qaAllSource,
  packageSource,
] = await Promise.all([
  readFile('functions/api/files/list.js', 'utf8'),
  readFile('src/lib/fileRepository.js', 'utf8'),
  readFile('src/panels/settings/SettingsPanelBody.jsx', 'utf8'),
  readFile('src/panels/settings/MediaLibrarySettings.jsx', 'utf8'),
  readFile('src/panels/settings/MediaLibrarySettings.css', 'utf8'),
  readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8'),
  readFile('src/editor/EditPanel.jsx', 'utf8'),
  readFile('src/editor/EditorMediaLibraryContext.jsx', 'utf8'),
  readFile('src/editor/imageControls.jsx', 'utf8'),
  readFile('src/editor/ImageLibraryPicker.jsx', 'utf8'),
  readFile('src/editor/ImageLibraryPicker.css', 'utf8'),
  readFile('src/editor/useImageInputPicker.js', 'utf8'),
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
assert(!mediaSource.includes('deleteProjectAsset') && !mediaSource.includes('미디어 삭제'), 'media library must remain non-destructive');
assert(mediaCssSource.includes('@media (max-width: 720px)') && mediaCssSource.includes('min-height: 44px'), 'media library mobile actions must retain 44px touch targets');

assert(workspaceActiveSource.includes('authUser={settingsPanelProps?.authUser || null}'), 'workspace must pass the current live auth user into the edit panel');
assert(editPanelSource.includes('<EditorMediaLibraryProvider page={page} authUser={authUser}>'), 'edit panel must scope image reuse to the active page and live auth state');
assert(editorMediaContextSource.includes('EditorMediaLibraryProvider({ page, authUser = null, children })'), 'editor media context must accept the live authenticated user');
assert(!editorMediaContextSource.includes('AUTH_KEY') && !editorMediaContextSource.includes('load('), 'editor media context must not re-read authentication from local storage');
assert(editorMediaContextSource.includes('EditorMediaLibraryContext.Provider'), 'editor media context provider missing');

assert(imageControlsSource.includes('useEditorMediaLibrary()'), 'shared ImageInput must read the editor media context');
assert(imageControlsSource.includes('내 이미지에서 선택'), 'shared ImageInput must expose the existing-image action');
assert(imageControlsSource.includes('<ImageLibraryPicker'), 'shared ImageInput must mount the project image picker');
assert(imageControlsSource.includes('selectExistingImage(nextValue)'), 'library selection must use the same ImageInput mutation guard');

assert(imagePickerSource.includes("listProjectAssets(page, authUser, { kind: 'image', limit: 100 })"), 'image picker must request only project images');
assert(imagePickerSource.includes("kind: 'image', cursor, limit: 100"), 'image picker must preserve cursor pagination');
assert(imagePickerSource.includes('type="search"') && imagePickerSource.includes('searchText(asset)'), 'image picker must support image search');
assert(imagePickerSource.includes('normalizeAssetValue') && imagePickerSource.includes('url.origin === window.location.origin'), 'image picker must keep same-origin asset references portable');
assert(imagePickerSource.includes('현재 이미지') && imagePickerSource.includes('aria-pressed={selected}'), 'image picker must identify the current image');
assert(!imagePickerSource.includes('deleteProjectAsset') && !imagePickerSource.includes('삭제'), 'image picker must not expose destructive asset actions');

assert(imagePickerHookSource.includes('selectExistingImage'), 'ImageInput picker hook must support existing project images');
assert(imagePickerHookSource.includes('siblingFingerprints.has(nextFingerprint)'), 'existing-image selection must keep gallery duplicate protection');
assert(imagePickerHookSource.includes("label: '내 이미지에서 선택 완료'"), 'existing-image selection must provide success feedback');

assert(imagePickerCssSource.includes('@media (max-width: 720px)') && imagePickerCssSource.includes('min-height: 44px'), 'image picker mobile actions must retain 44px touch targets');
assert(packageJson.scripts?.['media:library:qa'] === 'node scripts/media-library-quality-check.mjs', 'media:library:qa package script missing');
assert(qaAllSource.includes("['media:library:qa', ['scripts/media-library-quality-check.mjs']]"), 'release QA must include media library coverage');

console.log(JSON.stringify({
  ok: true,
  scope: 'project-media-library-and-editor-image-reuse',
  projectIsolation: true,
  imageVideoSeparation: true,
  pagination: true,
  editReadAuthorization: true,
  liveAuthState: true,
  searchAndFilters: true,
  imageVideoPreview: true,
  editorImageReuse: true,
  duplicateProtection: true,
  sameOriginPortability: true,
  destructiveActionsDeferred: true,
}, null, 2));
